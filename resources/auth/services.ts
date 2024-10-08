import { Err, Ok } from "../../ts-results/result.ts";
import { UserRecord, UserSchema } from "../user/types.ts";

import { createUserService } from "../user/services.ts";
import { sign, verify as verifyJWT } from "hono/jwt";
import { ulid } from "jsr:@std/ulid";
import { compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

import { HttpResult, JWTPayload2, ServicesOutput } from "../../types.ts";
import { AuthSessionRecord, LoginServiceData, TokensObject } from "./types.ts";
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
            authSessionRecord,
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
            authSessionRecord.id,
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
            createHttpSuccessResult(true, "Session deleted", 200, true),
        );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error deleting session: ${error?.name ?? "Unknown error"}`,
                500,
                true,
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

async function loginUserService(
    email: string,
    password: string,
): ServicesOutput<LoginServiceData> {
    try {
        if (email === "" || password === "") {
            return new Err<HttpResult>(
                createHttpErrorResult("Invalid login data", 400),
            );
        }

        const userDB = await Deno.openKv("user_db");
        if (userDB === null || userDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const secondaryKey = ["users_by_email", email];
        const primaryKeyMaybe = await userDB.get<string[]>(secondaryKey);
        const primaryKey = primaryKeyMaybe.value;
        if (primaryKey === null) {
            return new Err<HttpResult>(
                createHttpErrorResult("User not found", 404),
            );
        }

        const userRecordMaybe = await userDB.get<UserRecord>(primaryKey);
        userDB.close();
        const userRecord = userRecordMaybe.value;
        if (userRecord === null) {
            return new Err<HttpResult>(
                createHttpErrorResult("User not found", 404),
            );
        }

        console.log("userRecord", userRecord);

        const isPasswordCorrect = await compare(password, userRecord.password);
        if (!isPasswordCorrect) {
            return new Err<HttpResult>(
                createHttpErrorResult("Invalid credentials", 401),
            );
        }

        console.log("before create new auth session");

        const createdAuthSession = await createNewAuthSessionService(
            userRecord.id,
        );
        if (createdAuthSession.err) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error creating session", 500),
            );
        }

        const sessionId = createdAuthSession.safeUnwrap().data;
        const refreshTokenPayload: JWTPayload2 = {
            userId: userRecord.id,
            sessionId: sessionId,
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

        console.log("before refresh token sign");

        const refreshToken = await sign(
            refreshTokenPayload,
            REFRESH_TOKEN_SEED,
        );

        console.log("after refresh token sign");

        // const upsertRefreshTokenMaybe = await upsertAuthSessionTokensService(
        //     refreshToken,
        //     sessionId,
        // );
        // if (upsertRefreshTokenMaybe.err) {
        //     return upsertRefreshTokenMaybe;
        // }

        const ACCESS_TOKEN_SEED = Deno.env.get("ACCESS_TOKEN_SEED");
        if (ACCESS_TOKEN_SEED === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Access token seed not found", 500),
            );
        }

        const accessTokenPayload: JWTPayload2 = {
            userId: userRecord.id,
            sessionId: sessionId,
            exp: Date.now() + (1000 * 60 * 15), // 15 minutes
            nbf: Date.now(),
            iat: Date.now(),
        };

        const accessToken = await sign(
            accessTokenPayload,
            ACCESS_TOKEN_SEED,
        );

        return new Ok<HttpResult<LoginServiceData>>(
            createHttpSuccessResult(
                { user: userRecord, tokens: { accessToken, refreshToken } },
                "Logged in",
            ),
        );
    } catch (error) {
        console.log("called from loginUserService");
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
): ServicesOutput<LoginServiceData> {
    const createdUserResult = await createUserService(userSchema);
    if (createdUserResult.err) {
        return createdUserResult;
    }

    console.group("registerUserService");
    console.log("createdUserResult", createdUserResult);
    console.groupEnd();

    const user = createdUserResult.safeUnwrap().data;
    return await loginUserService(user.email, userSchema.password);
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
                createHttpErrorResult("Error opening database", 500, true),
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
                createHttpErrorResult("Session not found", 404, true),
            );
        }

        const isTokenInDenyList = authSessionRecord.refresh_tokens_deny_list
            .includes(
                refreshToken,
            );
        if (isTokenInDenyList) {
            return new Err<HttpResult>(
                createHttpErrorResult("Token in deny list", 401, true),
            );
        }

        const REFRESH_TOKEN_SEED = Deno.env.get("REFRESH_TOKEN_SEED");
        if (REFRESH_TOKEN_SEED === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult(
                    "Refresh token seed not found",
                    500,
                    true,
                ),
            );
        }

        const refreshTokenVerifyResult = await verifyPayload(
            refreshToken,
            REFRESH_TOKEN_SEED,
        );
        // if refresh token verification results in an error
        // and the error is not "Token expired", user is unauthenticated.
        if (
            refreshTokenVerifyResult.err &&
            refreshTokenVerifyResult.val.message !== "Token expired"
        ) {
            // refresh token is added to deny list
            await upsertAuthSessionTokensService(refreshToken, sessionId);
            // logout triggered
            return new Err<HttpResult>(
                createHttpErrorResult("Invalid refresh token", 401, true),
            );
        }

        // if token is expired and not in deny list, create new refresh token

        let newRefreshToken = refreshToken;
        if (
            refreshTokenVerifyResult.err &&
            refreshTokenVerifyResult.val.message === "Token expired"
        ) {
            const refreshTokenPayload: JWTPayload2 = {
                userId,
                sessionId,
                exp: Date.now() + (1000 * 60 * 60 * 24 * 1), // 1 day
                nbf: Date.now(),
                iat: Date.now(),
            };
            newRefreshToken = await sign(
                refreshTokenPayload,
                REFRESH_TOKEN_SEED,
            );
        }

        // if refresh token is valid, create new access token
        const ACCESS_TOKEN_SEED = Deno.env.get("ACCESS_TOKEN_SEED");
        if (ACCESS_TOKEN_SEED === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Access token seed not found", 500, true),
            );
        }

        const accessTokenVerifyResult = await verifyPayload(
            accessToken,
            ACCESS_TOKEN_SEED,
        );
        // if access token verification results in an error
        // and the error is not "Token expired", user is unauthenticated.
        if (
            accessTokenVerifyResult.err &&
            accessTokenVerifyResult.val.message !== "Token expired"
        ) {
            // refresh token is added to deny list
            await upsertAuthSessionTokensService(refreshToken, sessionId);
            // logout triggered
            return new Err<HttpResult>(
                createHttpErrorResult("Invalid access token", 401, true),
            );
        }

        let newAccessToken = accessToken;
        if (
            accessTokenVerifyResult.err &&
            accessTokenVerifyResult.val.message === "Token expired"
        ) {
            const newAccessTokenPayload: JWTPayload2 = {
                userId,
                sessionId,
                exp: Date.now() + (1000 * 60 * 15), // 15 minutes
                nbf: Date.now(),
                iat: Date.now(),
            };
            newAccessToken = await sign(
                newAccessTokenPayload,
                ACCESS_TOKEN_SEED,
            );
        }

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
                true,
            ),
        );
    }
}

async function logoutUserService(
    sessionId: string,
): ServicesOutput<boolean> {
    const result = await deleteAuthSessionService(sessionId);
    if (result.err) {
        return result;
    }

    return new Ok<HttpResult<boolean>>(
        createHttpSuccessResult(true, "Logged out", 200, true),
    );
}

async function verifyPayload(
    seed: string,
    token: string,
): ServicesOutput<boolean> {
    try {
        await verifyJWT(token, seed);
        return new Ok<HttpResult<boolean>>({
            data: true,
            kind: "success",
            message: "Token verified",
            status: 200,
        });
    } catch (error) {
        if (error?.name === "JwtAlgorithmNotImplemented") {
            return new Err<HttpResult>(
                createHttpErrorResult("Algorithm not implemented", 500),
            );
        }

        if (error?.name === "JwtTokenInvalid") {
            return new Err<HttpResult>(
                createHttpErrorResult("Invalid token", 400),
            );
        }

        if (error?.name === "JwtTokenNotBefore") {
            return new Err<HttpResult>(
                createHttpErrorResult("Token not yet valid", 400),
            );
        }

        if (error?.name === "JwtTokenExpired") {
            return new Err<HttpResult>(
                createHttpErrorResult("Token expired", 400),
            );
        }

        if (error?.name === "JwtTokenIssuedAt") {
            return new Err<HttpResult>(
                createHttpErrorResult("Token issued in the future", 400),
            );
        }

        if (error?.name === "JwtHeaderInvalid") {
            return new Err<HttpResult>(
                createHttpErrorResult("Invalid token header", 400),
            );
        }

        if (error?.name === "JwtTokenSignatureMismatched") {
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
    loginUserService,
    logoutUserService,
    registerUserService,
    tokensRefreshService,
    upsertAuthSessionTokensService,
    verifyPayload,
};
