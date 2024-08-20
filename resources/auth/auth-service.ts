import { Err, ErrImpl, Ok, OkImpl } from "../../ts-results/result.ts";
import { UserSchema } from "../user/user-model.ts";
import { hash, verify } from "@ts-rex/bcrypt";
import { createUserService } from "../user/user-service.ts";
import { decode, sign, verify as verifyJWT } from "hono/jwt";
import { ulid } from "jsr:@std/ulid";
import {
    JwtAlgorithmNotImplemented,
    JwtHeaderInvalid,
    JWTPayload,
    JwtTokenExpired,
    JwtTokenInvalid,
    JwtTokenIssuedAt,
    JwtTokenNotBefore,
    JwtTokenSignatureMismatched,
} from "jsr:@hono/hono@^4.5.6/utils/jwt/types";
import { HttpResult } from "../../types.ts";
import { AuthSessionSchema } from "./auth-types.ts";

/**
 * Result: Ok(true) == token IN deny list
 */
async function isTokenInDenyListService(
    refreshToken: string,
    sessionId: string,
): Promise<ErrImpl<HttpResult> | OkImpl<boolean>> {
    try {
        const denoDB = await Deno.openKv("auth_session_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Error opening auth database",
            });
        }

        const result = await denoDB.get<AuthSessionSchema>([
            "auth-sessions",
            sessionId,
        ]);
        denoDB.close();

        const authSession = result.value;
        if (authSession === null) {
            return new Err<HttpResult>({
                kind: "error",
                status: 404,
                message: "Session not found",
            });
        }

        return new Ok(
            authSession.refresh_tokens_deny_list.includes(refreshToken),
        );
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            status: 500,
            message: `Error checking deny list: ${error ?? "Unknown error"}`,
        });
    }
}

async function createNewAuthSessionService(
    authSessionSchema: AuthSessionSchema,
): Promise<ErrImpl<HttpResult> | OkImpl<AuthSessionSchema>> {
    try {
        const denoDB = await Deno.openKv("auth_session_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Error opening auth database",
            });
        }

        const result = await denoDB.set(
            ["auth-sessions", authSessionSchema.id],
            authSessionSchema,
            { expireIn: 1000 * 60 * 60 * 24 * 1 }, // 1 day
        );
        denoDB.close();

        return result.ok
            ? new Ok<AuthSessionSchema>(authSessionSchema)
            : new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Error creating auth session",
            });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            status: 500,
            message: `Error creating session: ${error ?? "Unknown error"}`,
        });
    }
}

async function deleteAuthSessionService(
    session_id: string,
): Promise<ErrImpl<HttpResult> | OkImpl<HttpResult>> {
    try {
        const denoDB = await Deno.openKv("auth_session_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Error opening auth database",
            });
        }

        await denoDB.delete(["auth-sessions", session_id]);
        denoDB.close();

        return new Ok<HttpResult>({
            kind: "success",
            status: 200,
            message: "Session deleted",
        });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            status: 500,
            message: `Error deleting session: ${error ?? "Unknown error"}`,
        });
    }
}

async function upsertAuthSessionTokensService(
    refreshToken: string,
    sessionId: string,
): Promise<ErrImpl<HttpResult> | OkImpl<AuthSessionSchema>> {
    try {
        const denoDB = await Deno.openKv("auth_session_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Error opening auth database",
            });
        }

        const result = await denoDB.get<AuthSessionSchema>([
            "auth-sessions",
            sessionId,
        ]);
        const authSession = result.value;
        if (authSession === null) {
            return new Err<HttpResult>({
                kind: "error",
                status: 404,
                message: "Session not found",
            });
        }

        authSession.refresh_tokens_deny_list.push(refreshToken);
        authSession.updated_at = Date.now().toLocaleString();

        const upsertResult = await denoDB.set(
            ["auth-sessions", sessionId],
            authSession,
        );
        denoDB.close();

        return upsertResult.ok
            ? new Ok<AuthSessionSchema>(authSession)
            : new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Error upserting auth session",
            });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            status: 500,
            message: `Error upserting session: ${error ?? "Unknown error"}`,
        });
    }
}

type LoginServiceOutput = Promise<
    | ErrImpl<HttpResult>
    | OkImpl<{ accessToken: string; refreshToken: string }>
>;
async function loginService(
    username: string,
    password: string,
): LoginServiceOutput {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Error opening database",
            });
        }

        const result = await denoDB.get<UserSchema>(["users", username]);
        denoDB.close();
        const user = result.value;

        if (user === null) {
            return new Err<HttpResult>({
                kind: "error",
                status: 404,
                message: "User not found",
            });
        }

        if (!verify(password, user.password)) {
            return new Err<HttpResult>({
                kind: "error",
                status: 400,
                message: "Invalid password",
            });
        }

        const authSessionSchema: AuthSessionSchema = {
            created_at: Date.now().toLocaleString(),
            id: ulid(),
            refresh_tokens_deny_list: [],
            updated_at: Date.now().toLocaleString(),
            user_id: user.id,
        };

        const authSessionResult = await createNewAuthSessionService(
            authSessionSchema,
        );
        if (authSessionResult.err) {
            return new Err<HttpResult>({
                kind: "error",
                status: 401,
                message: "Error creating auth session",
            });
        }

        const refreshTokenPayload: JWTPayload = {
            email: user.email,
            user_id: user.id,
            session_id: authSessionSchema.id,
            exp: Date.now() + (1000 * 60 * 60 * 24 * 1), // 1 day
            nbf: Date.now(),
            iat: Date.now(),
        };

        const REFRESH_TOKEN_SEED = Deno.env.get("REFRESH_TOKEN_SEED");
        if (REFRESH_TOKEN_SEED === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Refresh token seed not found",
            });
        }
        const refreshToken = await sign(
            refreshTokenPayload,
            REFRESH_TOKEN_SEED,
        );

        const ACCESS_TOKEN_SEED = Deno.env.get("ACCESS_TOKEN_SEED");
        if (ACCESS_TOKEN_SEED === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Access token seed not found",
            });
        }

        const accessTokenPayload: JWTPayload = {
            email: user.email,
            user_id: user.id,
            session_id: authSessionSchema.id,
            exp: Date.now() + (1000 * 60 * 15), // 15 minutes
            nbf: Date.now(),
            iat: Date.now(),
        };
        const accessToken = await sign(
            accessTokenPayload,
            ACCESS_TOKEN_SEED,
        );

        return new Ok({ accessToken, refreshToken });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            status: 500,
            message: `Error logging in: ${error ?? "Unknown error"}`,
        });
    }
}

async function registerService(user: UserSchema): LoginServiceOutput {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Error opening database",
            });
        }

        const result = await denoDB.get(["users", user.email]);
        const existingUser = result.value;

        if (existingUser !== null) {
            return new Err<HttpResult>({
                kind: "error",
                status: 400,
                message: "User already exists",
            });
        }
        denoDB.close();

        const createdUser = await createUserService(user);

        return createdUser.ok
            ? await loginService(user.email, user.password)
            : new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Error creating user",
            });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            status: 500,
            message: `Error registering user: ${error ?? "Unknown error"}`,
        });
    }
}

async function tokensRefreshService(
    { accessToken, refreshToken, sessionId, userId }: {
        accessToken: string;
        refreshToken: string;
        sessionId: string;
        userId: string;
    },
): Promise<
    | ErrImpl<HttpResult>
    | OkImpl<{ newAccessToken: string; newRefreshToken: string }>
> {
    try {
        const ACCESS_TOKEN_SEED = Deno.env.get("ACCESS_TOKEN_SEED");
        if (ACCESS_TOKEN_SEED === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Access token seed not found",
            });
        }

        const accessTokenVerification = await verifyPayload(
            accessToken,
            ACCESS_TOKEN_SEED,
        );
        if (
            accessTokenVerification.err &&
            accessTokenVerification.val.status === 400
        ) {
            return accessTokenVerification;
        }

        const REFRESH_TOKEN_SEED = Deno.env.get("REFRESH_TOKEN_SEED");
        if (REFRESH_TOKEN_SEED === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Refresh token seed not found",
            });
        }

        const refreshTokenVerification = await verifyPayload(
            refreshToken,
            REFRESH_TOKEN_SEED,
        );
        if (refreshTokenVerification.err) {
            await upsertAuthSessionTokensService(refreshToken, sessionId);
            return refreshTokenVerification;
        }

        // if refresh token is valid

        const denyListResult = await isTokenInDenyListService(
            refreshToken,
            sessionId,
        );
        if (denyListResult.err) {
            return new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "Error checking deny list",
            });
        }
        // if token in denylist
        if (denyListResult.safeUnwrap()) {
            return new Err<HttpResult>({
                kind: "error",
                status: 401,
                message: "Token in deny list",
            });
        }

        const newAccessTokenPayload: JWTPayload = {
            user_id: userId,
            session_id: sessionId,
            exp: Date.now() + (1000 * 60 * 15), // 15 minutes
            nbf: Date.now(),
            iat: Date.now(),
        };
        const newAccessToken = await sign(
            newAccessTokenPayload,
            ACCESS_TOKEN_SEED,
        );

        const newRefreshTokenPayload: JWTPayload = {
            user_id: userId,
            session_id: sessionId,
            exp: Date.now() + (1000 * 60 * 60 * 24 * 1), // 1 day
            nbf: Date.now(),
            iat: Date.now(),
        };
        const newRefreshToken = await sign(
            newRefreshTokenPayload,
            REFRESH_TOKEN_SEED,
        );

        return new Ok({ newAccessToken, newRefreshToken });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            status: 500,
            message: `Error refreshing tokens: ${error ?? "Unknown error"}`,
        });
    }
}

async function logoutService(
    sessionId: string,
): Promise<ErrImpl<HttpResult> | OkImpl<HttpResult>> {
    try {
        const result = await deleteAuthSessionService(sessionId);
        if (result.err) {
            return result;
        }

        return new Ok<HttpResult>({
            kind: "success",
            status: 200,
            message: "Logged out",
        });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            status: 500,
            message: `Error logging out: ${error ?? "Unknown error"}`,
        });
    }
}

async function verifyPayload(
    seed: string,
    token: string,
): Promise<ErrImpl<HttpResult> | OkImpl<boolean>> {
    try {
        await verifyJWT(token, seed);
        return new Ok(true);
    } catch (error) {
        if (error instanceof JwtAlgorithmNotImplemented) {
            return new Err<HttpResult>({
                kind: "error",
                status: 500,
                message: "JWT algorithm not implemented",
            });
        }

        if (error instanceof JwtTokenInvalid) {
            return new Err<HttpResult>({
                kind: "error",
                status: 400,
                message: "Invalid token",
            });
        }

        if (error instanceof JwtTokenNotBefore) {
            return new Err<HttpResult>({
                kind: "error",
                status: 400,
                message: "Token used before valid",
            });
        }

        if (error instanceof JwtTokenExpired) {
            return new Err<HttpResult>({
                kind: "error",
                status: 400,
                message: "Token expired",
            });
        }

        if (error instanceof JwtTokenIssuedAt) {
            return new Err<HttpResult>({
                kind: "error",
                status: 400,
                message: "Token issued in the future",
            });
        }

        if (error instanceof JwtHeaderInvalid) {
            return new Err<HttpResult>({
                kind: "error",
                status: 400,
                message: "Invalid header",
            });
        }

        if (error instanceof JwtTokenSignatureMismatched) {
            return new Err<HttpResult>({
                kind: "error",
                status: 400,
                message: "Token signature mismatched",
            });
        }

        return new Err<HttpResult>({
            kind: "error",
            status: 500,
            message: `Error verifying token: ${error?.name ?? "Unknown error"}`,
        });
    }
}

export {
    createNewAuthSessionService,
    deleteAuthSessionService,
    isTokenInDenyListService,
    loginService,
    logoutService,
    registerService,
    tokensRefreshService,
    upsertAuthSessionTokensService,
    verifyPayload,
};
