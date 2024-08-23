import { Hono } from "hono";

import { getAllAuthSessionsService, loginUserService } from "./services.ts";
import { HttpResult } from "../../types.ts";
import { createHttpErrorResult, createHttpSuccessResult } from "../../utils.ts";
import { ReqBodyAuthPOST } from "./types.ts";
import { setCookie } from "jsr:@hono/hono@^4.5.6/cookie";
import { UserSchema } from "../user/types.ts";
import { registerUserService } from "./services.ts";

const authRouter = new Hono();

// @desc   Get all auth sessions
// @route  GET /api/v1/auth/all
// @access Private
authRouter.get("/all", async (context) => {
    const authSessionsResult = await getAllAuthSessionsService();
    if (authSessionsResult.err) {
        return context.json<HttpResult>(authSessionsResult.val);
    }

    return context.json<HttpResult>(authSessionsResult.safeUnwrap());
});

// @desc   Login user
// @route  POST /api/v1/auth/login
// @access Public
authRouter.post("/login", async (context) => {
    try {
        const reqBody = await context.req.json<ReqBodyAuthPOST>();
        if (reqBody === null || reqBody === undefined) {
            return context.json<HttpResult>(
                createHttpErrorResult("Invalid login data", 400),
            );
        }

        const { email, password } = reqBody;
        const loginResult = await loginUserService(email, password);
        if (loginResult.err) {
            return context.json<HttpResult>(loginResult.val);
        }

        const { accessToken, refreshToken } = loginResult.safeUnwrap().data;

        setCookie(context, "access_token", accessToken, {
            expires: new Date(Date.now() + 60 * 15 * 1000), // 15 minutes
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        });
        setCookie(context, "refresh_token", refreshToken, {
            expires: new Date(Date.now() + 60 * 60 * 24 * 1000), // 24 hours
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        });

        return context.json<HttpResult>(
            createHttpSuccessResult(true, "User logged in", 200),
        );
    } catch (error) {
        return context.json<HttpResult>(
            createHttpErrorResult(
                `Error logging in user: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
});

// @desc   Register user
// @route  POST /api/v1/auth/register
// @access Public
authRouter.post("/register", async (context) => {
    try {
        const userSchema = await context.req.json<UserSchema>();
        if (userSchema === null || userSchema === undefined) {
            return context.json<HttpResult>(
                createHttpErrorResult("Invalid user data", 400),
            );
        }

        const registerResult = await registerUserService(userSchema);
        if (registerResult.err) {
            return context.json<HttpResult>(registerResult.val);
        }

        const { accessToken, refreshToken } = registerResult.safeUnwrap().data;

        setCookie(context, "access_token", accessToken, {
            expires: new Date(Date.now() + 60 * 15 * 1000), // 15 minutes
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        });

        setCookie(context, "refresh_token", refreshToken, {
            expires: new Date(Date.now() + 60 * 60 * 24 * 1000), // 24 hours
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        });

        return context.json<HttpResult>(
            createHttpSuccessResult(true, "User registered and logged in", 201),
        );
    } catch (error) {
        return context.json<HttpResult>(
            createHttpErrorResult(
                `Error registering user: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
});

// @desc   Refresh tokens
// @route  GET /api/v1/auth/refresh
// @access Private
authRouter.get("/refresh", async (context) => {
    try {
    } catch (error) {
        return context.json<HttpResult>(
            createHttpErrorResult(
                `Error refreshing tokens: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
});

// authRouter.get("/all", getAllAuthSessionsHandler);

// authRouter.get("/login", loginUserHandler);

// authRouter.post("/register", registerUserHandler);

// authRouter.get("/refresh", refreshTokensHandler);

// authRouter.get("/logout", logoutUserHandler);

export { authRouter };
