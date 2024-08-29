import { Hono } from "hono";

import {
    getAllAuthSessionsService,
    loginUserService,
    logoutUserService,
} from "./services.ts";
import { HttpRequestJSONBody, HttpResult } from "../../types.ts";
import { createHttpErrorResult, createHttpSuccessResult } from "../../utils.ts";
import { ReqBodyAuthPOST, ReqBodyLoginPOST } from "./types.ts";
import { deleteCookie, setCookie } from "jsr:@hono/hono@^4.5.6/cookie";
import { UserSchema } from "../user/types.ts";
import { registerUserService } from "./services.ts";
import { verifyJWTs } from "../../middlewares/verifyJWTs.ts";

const authRouter = new Hono();

// @desc   Get all auth sessions
// @route  GET /api/v1/auth/all
// @access Private
authRouter.use("/all", verifyJWTs);
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
        const reqBody = await context.req.json<ReqBodyLoginPOST>();
        if (reqBody === null || reqBody === undefined) {
            return context.json<HttpResult>(
                createHttpErrorResult("Invalid login data", 400),
            );
        }

        const { email, password } = reqBody;
        console.log("email", email);
        console.log("password", password);

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
        deleteCookie(context, "access_token");
        deleteCookie(context, "refresh_token");

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
        deleteCookie(context, "access_token");
        deleteCookie(context, "refresh_token");

        return context.json<HttpResult>(
            createHttpErrorResult(
                `Error registering user: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
});

// @desc   Logout user
// @route  POST /api/v1/auth/logout
// @access Private
authRouter.post("/logout", async (context) => {
    try {
        const { sessionId } = await context.req.json<HttpRequestJSONBody>();
        const logoutUserResult = await logoutUserService(sessionId);
        if (logoutUserResult.err) {
            return context.json<HttpResult>(logoutUserResult.val);
        }

        deleteCookie(context, "access_token");
        deleteCookie(context, "refresh_token");

        return context.json<HttpResult>(
            createHttpSuccessResult(true, "User logged out", 200, true),
        );
    } catch (error) {
        deleteCookie(context, "access_token");
        deleteCookie(context, "refresh_token");

        return context.json<HttpResult>(
            createHttpErrorResult(
                `Error logging out user: ${error?.name ?? "Unknown error"}`,
                500,
                true,
            ),
        );
    }
});

export { authRouter };
