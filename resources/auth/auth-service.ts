import { Err, Ok } from "../../ts-results/result.ts";
import { UserSchema } from "../user/user-model.ts";
import { verify } from "@ts-rex/bcrypt";
import { createUserService } from "../user/user-service.ts";
import { sign, verify as verifyJWT } from "hono/jwt";
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
import { HttpResult, ServicesOutput } from "../../types.ts";
import { AuthSessionSchema } from "./auth-types.ts";

/**
 * Result: Ok(true) == token IN deny list
 */
async function isTokenInDenyListService(
    refreshToken: string,
    sessionId: string,
): ServicesOutput<boolean> {
    try {
        const denoDB = await Deno.openKv("auth_session_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Error opening auth database",
                status: 500,
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
                message: "Session not found",
                status: 404,
            });
        }

        return new Ok<HttpResult<boolean>>(
            {
                data: [authSession.refresh_tokens_deny_list.includes(
                    refreshToken,
                )],
                kind: "success",
                message: "",
                status: 200,
            },
        );
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            message: `Error checking deny list: ${error ?? "Unknown error"}`,
            status: 500,
        });
    }
}

async function createNewAuthSessionService(
    authSessionSchema: AuthSessionSchema,
): ServicesOutput<AuthSessionSchema> {
    try {
        const denoDB = await Deno.openKv("auth_session_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Error opening auth database",
                status: 500,
            });
        }

        const result = await denoDB.set(
            ["auth-sessions", authSessionSchema.id],
            authSessionSchema,
            { expireIn: 1000 * 60 * 60 * 24 * 1 }, // 1 day
        );
        denoDB.close();

        return result.ok
            ? new Ok<HttpResult<AuthSessionSchema>>({
                data: [authSessionSchema],
                kind: "success",
                message: "Session created",
                status: 200,
            })
            : new Err<HttpResult>({
                kind: "error",
                message: "Error creating auth session",
                status: 500,
            });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            message: `Error creating session: ${error ?? "Unknown error"}`,
            status: 500,
        });
    }
}

async function deleteAuthSessionService(
    session_id: string,
): ServicesOutput<boolean> {
    try {
        const denoDB = await Deno.openKv("auth_session_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Error opening auth database",
                status: 500,
            });
        }

        await denoDB.delete(["auth-sessions", session_id]);
        denoDB.close();

        return new Ok<HttpResult<boolean>>({
            data: [true],
            kind: "success",
            message: "Session deleted",
            status: 200,
        });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            message: `Error deleting session: ${error ?? "Unknown error"}`,
            status: 500,
        });
    }
}

async function upsertAuthSessionTokensService(
    refreshToken: string,
    sessionId: string,
): ServicesOutput<AuthSessionSchema> {
    try {
        const denoDB = await Deno.openKv("auth_session_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Error opening auth database",
                status: 500,
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
                message: "Session not found",
                status: 404,
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
            ? new Ok<HttpResult<AuthSessionSchema>>({
                data: [authSession],
                kind: "success",
                message: "Session updated",
                status: 200,
            })
            : new Err<HttpResult>({
                kind: "error",
                message: "Error upserting auth session",
                status: 500,
            });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            message: `Error upserting session: ${error ?? "Unknown error"}`,
            status: 500,
        });
    }
}

type TokensObject = { accessToken: string; refreshToken: string };

async function loginService(
    username: string,
    password: string,
): ServicesOutput<TokensObject> {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Error opening database",
                status: 500,
            });
        }

        const result = await denoDB.get<UserSchema>(["users", username]);
        denoDB.close();
        const user = result.value;

        if (user === null) {
            return new Err<HttpResult>({
                kind: "error",
                message: "User not found",
                status: 404,
            });
        }

        if (!verify(password, user.password)) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Invalid password",
                status: 400,
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
                message: "Error creating auth session",
                status: 401,
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
                message: "Refresh token seed not found",
                status: 500,
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
                message: "Access token seed not found",
                status: 500,
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

        return new Ok<HttpResult<TokensObject>>({
            data: [{ accessToken, refreshToken }],
            kind: "success",
            message: "Logged in",
            status: 200,
        });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            message: `Error logging in: ${error ?? "Unknown error"}`,
            status: 500,
        });
    }
}

async function registerService(
    user: UserSchema,
): ServicesOutput<TokensObject> {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Error opening database",
                status: 500,
            });
        }

        const result = await denoDB.get(["users", user.email]);
        const existingUser = result.value;

        if (existingUser !== null) {
            return new Err<HttpResult>({
                kind: "error",
                message: "User already exists",
                status: 400,
            });
        }
        denoDB.close();

        const createdUser = await createUserService(user);

        return createdUser.ok
            ? await loginService(user.email, user.password)
            : new Err<HttpResult>({
                kind: "error",
                message: "Error creating user",
                status: 500,
            });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            message: `Error registering user: ${error ?? "Unknown error"}`,
            status: 500,
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
): ServicesOutput<TokensObject> {
    try {
        const ACCESS_TOKEN_SEED = Deno.env.get("ACCESS_TOKEN_SEED");
        if (ACCESS_TOKEN_SEED === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Access token seed not found",
                status: 500,
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
                message: "Refresh token seed not found",
                status: 500,
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
                message: "Error checking deny list",
                status: 500,
            });
        }
        // if token in denylist
        if (denyListResult.safeUnwrap()) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Token in deny list",
                status: 401,
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

        return new Ok<HttpResult<TokensObject>>({
            data: [{
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            }],
            kind: "success",
            message: "Tokens refreshed",
            status: 200,
        });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            message: `Error refreshing tokens: ${error ?? "Unknown error"}`,
            status: 500,
        });
    }
}

async function logoutService(
    sessionId: string,
): ServicesOutput<boolean> {
    try {
        const result = await deleteAuthSessionService(sessionId);
        if (result.err) {
            return result;
        }

        return new Ok<HttpResult<boolean>>({
            data: [true],
            kind: "success",
            message: "Logged out",
            status: 200,
        });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            message: `Error logging out: ${error ?? "Unknown error"}`,
            status: 500,
        });
    }
}

async function verifyPayload(
    seed: string,
    token: string,
): ServicesOutput<boolean> {
    try {
        await verifyJWT(token, seed);
        return new Ok<HttpResult<boolean>>({
            data: [true],
            kind: "success",
            message: "Token verified",
            status: 200,
        });
    } catch (error) {
        if (error instanceof JwtAlgorithmNotImplemented) {
            return new Err<HttpResult>({
                kind: "error",
                message: "JWT algorithm not implemented",
                status: 500,
            });
        }

        if (error instanceof JwtTokenInvalid) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Invalid token",
                status: 400,
            });
        }

        if (error instanceof JwtTokenNotBefore) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Token used before valid",
                status: 400,
            });
        }

        if (error instanceof JwtTokenExpired) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Token expired",
                status: 400,
            });
        }

        if (error instanceof JwtTokenIssuedAt) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Token issued in the future",
                status: 400,
            });
        }

        if (error instanceof JwtHeaderInvalid) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Invalid header",
                status: 400,
            });
        }

        if (error instanceof JwtTokenSignatureMismatched) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Token signature mismatched",
                status: 400,
            });
        }

        return new Err<HttpResult>({
            kind: "error",
            message: `Error verifying token: ${error?.name ?? "Unknown error"}`,
            status: 500,
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
