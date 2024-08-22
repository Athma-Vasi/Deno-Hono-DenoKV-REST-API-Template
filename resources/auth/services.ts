import { Err, Ok } from "../../ts-results/result.ts";
import { UserRecord, UserSchema } from "../user/types.ts";
import { verify } from "@ts-rex/bcrypt";
import { createUserService } from "../user/services.ts";
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
import { AuthSessionRecord } from "./types.ts";
import {
    checkIfValueExistsInDenoDB,
    createHttpErrorResult,
    createHttpSuccessResult,
    openDenoDBAndDeleteValueService,
    openDenoDBAndGetValueService,
    openDenoDBAndSetValueService,
} from "../../utils.ts";

/**
 * Result: Ok(true) == token IN deny list
 */
async function isTokenInDenyListService(
    refreshToken: string,
    sessionId: string,
): ServicesOutput<boolean> {
    const openDBResult = await openDenoDBAndGetValueService<AuthSessionRecord>(
        "auth_session_db",
        ["auth_sessions", sessionId],
    );

    if (openDBResult.err) {
        return openDBResult;
    }

    const authSessionResult = openDBResult.safeUnwrap();
    const authSessionRecord = authSessionResult.data?.[0];
    if (authSessionRecord === undefined) {
        return new Err<HttpResult>(
            createHttpErrorResult("Session not found", 404),
        );
    }

    return new Ok<HttpResult<boolean>>(
        createHttpSuccessResult(
            authSessionRecord.refresh_tokens_deny_list.includes(refreshToken),
            "Token in deny list",
        ),
    );
}

async function createNewAuthSessionService(
    AuthSessionRecord: AuthSessionRecord,
): ServicesOutput<boolean> {
    return await openDenoDBAndSetValueService<AuthSessionRecord>(
        "auth_session_db",
        ["auth_sessions", AuthSessionRecord.id],
        AuthSessionRecord,
    );
}

async function deleteAuthSessionService(
    session_id: string,
): ServicesOutput<boolean> {
    return await openDenoDBAndDeleteValueService(
        "auth_session_db",
        ["auth_sessions", session_id],
    );
}

async function upsertAuthSessionTokensService(
    refreshToken: string,
    sessionId: string,
): ServicesOutput<AuthSessionRecord> {
    try {
        const denoDBResult = await openDenoDBAndGetValueService<
            AuthSessionRecord
        >(
            "auth_session_db",
            ["auth_sessions", sessionId],
        );
        if (denoDBResult.err) {
            return denoDBResult;
        }

        const authSessionResult = denoDBResult.safeUnwrap();
        const authSession = authSessionResult.data[0];

        authSession.refresh_tokens_deny_list.push(refreshToken);
        authSession.updated_at = new Date().toISOString();

        const upsertResult = await openDenoDBAndSetValueService<
            AuthSessionRecord
        >(
            "auth_session_db",
            ["auth_sessions", sessionId],
            authSession,
        );

        return upsertResult.ok
            ? new Ok<HttpResult<AuthSessionRecord>>(
                createHttpSuccessResult(authSession, "Session updated"),
            )
            : new Ok<HttpResult<AuthSessionRecord>>(
                createHttpSuccessResult(
                    authSession,
                    "Unable to update session",
                ),
            );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error upserting session: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

type TokensObject = { accessToken: string; refreshToken: string };

async function loginService(
    email: string,
    password: string,
): ServicesOutput<TokensObject> {
    try {
        const openDBResult = await openDenoDBAndGetValueService<UserRecord>(
            "user_db",
            ["users", email],
        );
        if (openDBResult.err) {
            return openDBResult;
        }

        const userResult = openDBResult.safeUnwrap();
        const user = userResult.data[0];

        if (!verify(password, user.password)) {
            return new Err<HttpResult>(
                createHttpErrorResult("Invalid credentials", 401),
            );
        }

        const AuthSessionRecord: AuthSessionRecord = {
            created_at: new Date().toISOString(),
            id: ulid(),
            refresh_tokens_deny_list: [],
            updated_at: new Date().toISOString(),
            user_id: user.id,
        };

        const authSessionResult = await createNewAuthSessionService(
            AuthSessionRecord,
        );
        if (authSessionResult.err) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error creating session", 500),
            );
        }

        const refreshTokenPayload: JWTPayload = {
            email: user.email,
            user_id: user.id,
            session_id: AuthSessionRecord.id,
            exp: Date.now() + (1000 * 60 * 60 * 24 * 1), // 1 day
            nbf: Date.now(),
            iat: Date.now(),
        };

        const REFRESH_TOKEN_SEED = Deno.env.get("REFRESH_TOKEN_SEED");
        if (REFRESH_TOKEN_SEED === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Refresh token seed not found", 500),
            );
        }
        const refreshToken = await sign(
            refreshTokenPayload,
            REFRESH_TOKEN_SEED,
        );

        const ACCESS_TOKEN_SEED = Deno.env.get("ACCESS_TOKEN_SEED");
        if (ACCESS_TOKEN_SEED === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Access token seed not found", 500),
            );
        }

        const accessTokenPayload: JWTPayload = {
            email: user.email,
            user_id: user.id,
            session_id: AuthSessionRecord.id,
            exp: Date.now() + (1000 * 60 * 15), // 15 minutes
            nbf: Date.now(),
            iat: Date.now(),
        };
        const accessToken = await sign(
            accessTokenPayload,
            ACCESS_TOKEN_SEED,
        );

        return new Ok<HttpResult<TokensObject>>(
            createHttpSuccessResult(
                { accessToken, refreshToken },
                "Logged in",
            ),
        );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error logging in: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

async function registerUserService(
    user: UserSchema,
): ServicesOutput<TokensObject> {
    try {
        console.log("registerUserService");
        const isUserExistsResult = await checkIfValueExistsInDenoDB<UserRecord>(
            "user_db",
            ["users", user.email],
        );
        console.log("isUserExistsResult", isUserExistsResult);
        if (isUserExistsResult.err) {
            return isUserExistsResult;
        }

        const userExists = isUserExistsResult.safeUnwrap().data[0];
        console.log("userExists", userExists);
        if (userExists) {
            return new Err<HttpResult>(
                createHttpErrorResult("User already exists", 400),
            );
        }

        const createdUser = await createUserService(user);

        console.log("createdUser", createdUser);

        return createdUser.ok
            ? await loginService(user.email, user.password)
            : new Err<HttpResult>(
                createHttpErrorResult("Error registering user", 500),
            );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error registering user: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
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
            return new Err<HttpResult>(
                createHttpErrorResult("Access token seed not found", 500),
            );
        }

        const accessTokenVerifyResult = await verifyPayload(
            accessToken,
            ACCESS_TOKEN_SEED,
        );
        if (
            accessTokenVerifyResult.err &&
            accessTokenVerifyResult.val.status === 400
        ) {
            return accessTokenVerifyResult;
        }

        const REFRESH_TOKEN_SEED = Deno.env.get("REFRESH_TOKEN_SEED");
        if (REFRESH_TOKEN_SEED === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Refresh token seed not found", 500),
            );
        }

        const refreshTokenVerifyResult = await verifyPayload(
            refreshToken,
            REFRESH_TOKEN_SEED,
        );
        if (refreshTokenVerifyResult.err) {
            await upsertAuthSessionTokensService(refreshToken, sessionId);
            return refreshTokenVerifyResult;
        }

        // if refresh token is valid
        const isTokenPresentResult = await isTokenInDenyListService(
            refreshToken,
            sessionId,
        );
        if (isTokenPresentResult.err) {
            return isTokenPresentResult;
        }

        // if token in denylist
        const unwrappedHttpResult = isTokenPresentResult.safeUnwrap();
        const isTokenInDenyList = unwrappedHttpResult.data[0];
        if (isTokenInDenyList) {
            return new Err<HttpResult>(
                createHttpErrorResult("Token in deny list", 401),
            );
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

        return new Ok<HttpResult<TokensObject>>(
            createHttpSuccessResult(
                { accessToken: newAccessToken, refreshToken: newRefreshToken },
                "Tokens refreshed",
                200,
            ),
        );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error refreshing tokens: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

async function logoutService(
    sessionId: string,
): ServicesOutput<boolean> {
    const result = await deleteAuthSessionService(sessionId);
    if (result.err) {
        return result;
    }

    return new Ok<HttpResult<boolean>>(
        createHttpSuccessResult(true, "Logged out", 200),
    );
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
            return new Err<HttpResult>(
                createHttpErrorResult("Algorithm not implemented", 500),
            );
        }

        if (error instanceof JwtTokenInvalid) {
            return new Err<HttpResult>(
                createHttpErrorResult("Invalid token", 400),
            );
        }

        if (error instanceof JwtTokenNotBefore) {
            return new Err<HttpResult>(
                createHttpErrorResult("Token not yet valid", 400),
            );
        }

        if (error instanceof JwtTokenExpired) {
            return new Err<HttpResult>(
                createHttpErrorResult("Token expired", 400),
            );
        }

        if (error instanceof JwtTokenIssuedAt) {
            return new Err<HttpResult>(
                createHttpErrorResult("Token issued in the future", 400),
            );
        }

        if (error instanceof JwtHeaderInvalid) {
            return new Err<HttpResult>(
                createHttpErrorResult("Invalid token header", 400),
            );
        }

        if (error instanceof JwtTokenSignatureMismatched) {
            return new Err<HttpResult>(
                createHttpErrorResult("Token signature mismatched", 400),
            );
        }

        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error verifying token: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

export {
    createNewAuthSessionService,
    deleteAuthSessionService,
    isTokenInDenyListService,
    loginService,
    logoutService,
    registerUserService,
    tokensRefreshService,
    upsertAuthSessionTokensService,
    verifyPayload,
};
