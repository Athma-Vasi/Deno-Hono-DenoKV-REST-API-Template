import { Context } from "hono";
import { HttpResult } from "../../types.ts";
import { UserSchema } from "../user/types.ts";
import { registerUserService } from "./services.ts";
import { createHttpErrorResult, createHttpSuccessResult } from "../../utils.ts";

async function loginUserHandler(ctx: Context) {
    return ctx.text("Login");
}

// @desc   Register a new user
// @route  POST /api/v1/auth/register
// @access Public
async function registerUserHandler(ctx: Context) {
    try {
        const userSchema = await ctx.req.json<UserSchema>();
        if (userSchema === null || userSchema === undefined) {
            return ctx.json<HttpResult>(createHttpErrorResult(
                "Error registering user: Invalid user data",
                400,
            ));
        }

        const registerResult = await registerUserService(userSchema);
        if (registerResult.err) {
            return ctx.json<HttpResult>(registerResult.val);
        }

        const tokensResult = registerResult.safeUnwrap();
        const { accessToken, refreshToken } = tokensResult.data?.[0] ??
            { accessToken: "", refreshToken: "" };

        return ctx.json<HttpResult>(
            createHttpSuccessResult(
                { accessToken, refreshToken },
                "User registered",
                201,
            ),
        );
    } catch (error) {
        return ctx.json<HttpResult>(
            createHttpErrorResult(
                `Error registering user: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

async function refreshTokensHandler(ctx: Context) {
    return ctx.text("Refresh");
}

async function logoutUserHandler(ctx: Context) {
    return ctx.text("Logout");
}

export {
    loginUserHandler,
    logoutUserHandler,
    refreshTokensHandler,
    registerUserHandler,
};
