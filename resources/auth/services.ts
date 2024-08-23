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
import { AuthSessionRecord, TokensObject } from "./types.ts";
import { createHttpErrorResult, createHttpSuccessResult } from "../../utils.ts";

async function getAllAuthSessionsService() {
    try {
        const authDB = await Deno.openKv("auth_session_db");
        if (authDB === null || authDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const authSessions = [] as unknown[];
        for await (
            const result of authDB.list({ prefix: ["auth_sessions"] }, {
                limit: 10,
            })
        ) {
            authSessions.push(result.value);
        }
        authDB.close();

        return new Ok<HttpResult>(
            createHttpSuccessResult(authSessions, "Auth sessions found", 200),
        );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error getting auth sessions: ${
                    error?.name ?? "Unknown error"
                }`,
                500,
            ),
        );
    }
}

/**
 * Result: Ok(true) == token IN deny list
 */
async function isTokenInDenyListService(
    refreshToken: string,
    sessionId: string,
): ServicesOutput<boolean> {
    try {
        const authDB = await Deno.openKv("auth_session_db");
        if (authDB === null || authDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const primaryKey = ["auth_sessions", sessionId];
        const authSessionMaybe = await authDB.get<AuthSessionRecord>(
            primaryKey,
        );
        const authSessionRecord = authSessionMaybe.value;
        authDB.close();

        if (authSessionRecord === null) {
            return new Err<HttpResult>(
                createHttpErrorResult("Session not found", 404),
            );
        }

        const isTokenInDenyList = authSessionRecord.refresh_tokens_deny_list
            .includes(
                refreshToken,
            );

        return new Ok<HttpResult<boolean>>(
            createHttpSuccessResult(
                isTokenInDenyList,
                `Token ${isTokenInDenyList ? "in" : "not in"} deny list`,
            ),
        );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error checking if token in deny list: ${
                    error?.name ?? "Unknown error"
                }`,
                500,
            ),
        );
    }
}

async function createNewAuthSessionService(
    userId: string,
): ServicesOutput<string> {
    try {
        const authDB = await Deno.openKv("auth_session_db");
        if (authDB === null || authDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        // secondary keys value is primary key
        // primary keys value is record

        const secondaryKey = [
            "auth_sessions_by_user_id",
            userId,
        ];
        const primaryKeyMaybe = await authDB.get<string[]>(secondaryKey);
        const primaryKey = primaryKeyMaybe.value;
        if (primaryKey !== null) {
            return new Err<HttpResult>(
                createHttpErrorResult("Auth session already exists", 400),
            );
        }

        const authSessionRecord: AuthSessionRecord = {
            created_at: new Date().toISOString(),
            id: ulid(),
            refresh_tokens_deny_list: [],
            updated_at: new Date().toISOString(),
            user_id: userId,
        };

        const createSessionMaybe = await authDB.set(
            ["auth_sessions", authSessionRecord.id], // primary key
            [authSessionRecord],
            { expireIn: 1000 * 60 * 60 * 24 * 1 }, // 1 day
        );
        if (!createSessionMaybe.ok) {
            authDB.close();
            return new Err<HttpResult>(
                createHttpErrorResult("Error creating session", 500),
            );
        }

        const secondaryKeyMaybe = await authDB.set(
            secondaryKey,
            [authSessionRecord.id],
        );
        authDB.close();
        if (!secondaryKeyMaybe.ok) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error creating session", 500),
            );
        }

        return new Ok<HttpResult<string>>(
            createHttpSuccessResult(
                authSessionRecord.id,
                "Session created",
                201,
            ),
        );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error creating session: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

async function deleteAuthSessionService(
    sessionId: string,
): ServicesOutput<boolean> {
    try {
        const authDB = await Deno.openKv("auth_session_db");
        if (authDB === null || authDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const primaryKey = ["auth_sessions", sessionId];
        const deleteSessionMaybe = await authDB.atomic().delete(primaryKey)
            .commit();
        authDB.close();

        if (!deleteSessionMaybe.ok) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error deleting session", 500),
            );
        }

        return new Ok<HttpResult<boolean>>(
            createHttpSuccessResult(true, "Session deleted", 200),
        );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error deleting session: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

async function upsertAuthSessionTokensService(
    refreshToken: string,
    sessionId: string,
): ServicesOutput<AuthSessionRecord> {
    try {
        const authDB = await Deno.openKv("auth_session_db");
        if (authDB === null || authDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const primaryKey = ["auth_sessions", sessionId];
        const authSessionMaybe = await authDB.get<AuthSessionRecord>(
            primaryKey,
        );
        const authSessionRecord = authSessionMaybe.value;

        if (authSessionRecord === null) {
            authDB.close();
            return new Err<HttpResult>(
                createHttpErrorResult("Session not found", 404),
            );
        }

        authSessionRecord.refresh_tokens_deny_list.push(refreshToken);
        authSessionRecord.updated_at = new Date().toISOString();

        const upsertMaybe = await authDB.set(
            primaryKey,
            authSessionRecord,
            { expireIn: 1000 * 60 * 60 * 24 * 1 }, // 1 day
        );
        authDB.close();

        if (!upsertMaybe.ok) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error upserting session", 500),
            );
        }

        return new Ok<HttpResult<AuthSessionRecord>>(
            createHttpSuccessResult(
                authSessionRecord,
                "Session updated",
                200,
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

async function loginService(
    email: string,
    password: string,
): ServicesOutput<TokensObject> {
    try {
        const userDB = await Deno.openKv("user_db");
        if (userDB === null || userDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const secondaryKey = ["users_by_email", email];
        const userRecordMaybe = await userDB.get<UserRecord>(secondaryKey);
        userDB.close();

        const userRecord = userRecordMaybe.value;
        if (userRecord === null) {
            return new Err<HttpResult>(
                createHttpErrorResult("User not found", 404),
            );
        }

        if (!verify(password, userRecord.password)) {
            return new Err<HttpResult>(
                createHttpErrorResult("Invalid credentials", 401),
            );
        }

        const createdAuthSession = await createNewAuthSessionService(
            userRecord.id,
        );
        if (createdAuthSession.err) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error creating session", 500),
            );
        }

        const sessionId = createdAuthSession.safeUnwrap().data[0];
        const refreshTokenPayload: JWTPayload = {
            email: userRecord.email,
            user_id: userRecord.id,
            session_id: sessionId,
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

        const upsertRefreshTokenMaybe = await upsertAuthSessionTokensService(
            refreshToken,
            sessionId,
        );
        if (upsertRefreshTokenMaybe.err) {
            return upsertRefreshTokenMaybe;
        }

        const ACCESS_TOKEN_SEED = Deno.env.get("ACCESS_TOKEN_SEED");
        if (ACCESS_TOKEN_SEED === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Access token seed not found", 500),
            );
        }

        const accessTokenPayload: JWTPayload = {
            email: userRecord.email,
            user_id: userRecord.id,
            session_id: refreshTokenPayload.session_id,
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
    userSchema: UserSchema,
): ServicesOutput<TokensObject> {
    const createdUserResult = await createUserService(userSchema);
    if (createdUserResult.err) {
        return createdUserResult;
    }

    const user = createdUserResult.safeUnwrap().data[0];
    return await loginService(user.email, user.password);
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
        const authDB = await Deno.openKv("auth_session_db");
        if (authDB === null || authDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const primaryKey = ["auth_sessions", sessionId];
        const authSessionMaybe = await authDB.get<AuthSessionRecord>(
            primaryKey,
        );
        const authSessionRecord = authSessionMaybe.value;
        authDB.close();

        if (authSessionRecord === null) {
            return new Err<HttpResult>(
                createHttpErrorResult("Session not found", 404),
            );
        }

        const isTokenInDenyListResult = await isTokenInDenyListService(
            refreshToken,
            sessionId,
        );
        if (isTokenInDenyListResult.err) {
            return isTokenInDenyListResult;
        }

        const unwrappedHttpResult = isTokenInDenyListResult.safeUnwrap();
        const isTokenInDenyList = unwrappedHttpResult.data[0];
        if (isTokenInDenyList) {
            return new Err<HttpResult>(
                createHttpErrorResult("Token in deny list", 401),
            );
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
        if (accessTokenVerifyResult.err) {
            return accessTokenVerifyResult;
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
    getAllAuthSessionsService,
    isTokenInDenyListService,
    loginService,
    logoutService,
    registerUserService,
    tokensRefreshService,
    upsertAuthSessionTokensService,
    verifyPayload,
};
