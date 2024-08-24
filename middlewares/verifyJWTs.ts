import { Context, Next } from "hono";
import {
    deleteCookie,
    getCookie,
    setCookie,
} from "jsr:@hono/hono@^4.5.6/cookie";
import { HttpRequestJSONBody, HttpResult } from "../types.ts";
import { createHttpErrorResult } from "../utils.ts";
import { tokensRefreshService } from "../resources/auth/services.ts";

/**
 * - Verifies the JWTs in the cookies.
 * - If the JWTs are valid, it refreshes the JWTs and sets the new JWTs in the cookies.
 * - If the JWTs are invalid, it returns an error response.
 */
async function verifyJWTs(context: Context, next: Next) {
    try {
        const accessToken = getCookie(context, "access_token");
        if (accessToken === undefined) {
            return context.json<HttpResult>(
                createHttpErrorResult("No access token", 401, true),
            );
        }

        const refreshToken = getCookie(context, "refresh_token");
        if (refreshToken === undefined) {
            return context.json<HttpResult>(
                createHttpErrorResult("No refresh token", 401, true),
            );
        }

        const reqBody = await context.req.json<HttpRequestJSONBody>();
        if (reqBody === null || reqBody === undefined) {
            return context.json<HttpResult>(
                createHttpErrorResult("Invalid request body", 400, true),
            );
        }

        const { userId, sessionId } = reqBody;
        const tokensRefreshResult = await tokensRefreshService({
            accessToken,
            refreshToken,
            sessionId,
            userId,
        });
        if (tokensRefreshResult.err) {
            return context.json<HttpResult>(tokensRefreshResult.val);
        }

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            tokensRefreshResult.safeUnwrap().data;

        setCookie(context, "access_token", newAccessToken, {
            expires: new Date(Date.now() + 60 * 15 * 1000), // 15 minutes
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        });

        setCookie(context, "refresh_token", newRefreshToken, {
            expires: new Date(Date.now() + 60 * 60 * 24 * 1000), // 24 hours
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        });

        return next();
    } catch (error) {
        deleteCookie(context, "access_token");
        deleteCookie(context, "refresh_token");

        return context.json<HttpResult>(
            createHttpErrorResult(
                `Error verifying JWTs: ${error?.name ?? "Unknown error"}`,
                401,
                true,
            ),
        );
    }
}

export { verifyJWTs };
