import { Err, ErrImpl, Ok, OkImpl } from "../../ts-results/result.ts";
import { UserSchema } from "../user/user-model.ts";
import { hash, verify } from "@ts-rex/bcrypt";
import { createUserService } from "../user/user-service.ts";
import { HttpResult, JWTPayload } from "../../types.ts";
import { decode, sign, verify as verifyJWT } from "hono/jwt";

type LoginServiceOutput = Promise<
    | ErrImpl<HttpResult>
    | OkImpl<{
        accessToken: string;
        refreshToken: string;
    }>
>;
async function loginService(
    username: string,
    password: string,
): LoginServiceOutput {
    try {
        const denoDB = await Deno.openKv("user-db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                status: 500,
                message: "Error opening database",
            });
        }

        const result = await denoDB.get<UserSchema>(["users", username]);
        denoDB.close();
        const user = result.value;

        if (user === null) {
            return new Err<HttpResult>({
                status: 404,
                message: "User not found",
            });
        }

        if (!verify(password, user.password)) {
            return new Err<HttpResult>({
                status: 400,
                message: "Invalid password",
            });
        }

        const refreshTokenPayload: JWTPayload = {
            userId: user.id,
            email: user.email,
            exp: Date.now() + (1000 * 60 * 60 * 24 * 7), // 7 days
            nbf: Date.now(),
            iat: Date.now(),
        };

        const REFRESH_TOKEN_SEED = Deno.env.get("REFRESH_TOKEN_SEED");
        if (REFRESH_TOKEN_SEED === undefined) {
            return new Err<HttpResult>({
                status: 500,
                message: "Refresh token not found",
            });
        }
        const refreshToken = await sign(
            refreshTokenPayload,
            REFRESH_TOKEN_SEED,
        );

        const ACCESS_TOKEN_SEED = Deno.env.get("ACCESS_TOKEN_SEED");
        if (ACCESS_TOKEN_SEED === undefined) {
            return new Err<HttpResult>({
                status: 500,
                message: "Access token not found",
            });
        }

        const accessTokenPayload: JWTPayload = {
            userId: user.id,
            email: user.email,
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
            status: 500,
            message: `Error logging in: ${error ?? "Unknown error"}`,
        });
    }
}

async function registerService(user: UserSchema) {
    const denoDB = await Deno.openKv("user-db");
    if (denoDB === null || denoDB === undefined) {
        return new Err<HttpResult>({
            status: 500,
            message: "Error opening database",
        });
    }

    const result = await denoDB.get(["users", user.email]);
    if (result.value !== null) {
        return new Err<HttpResult>({
            status: 400,
            message: "User already exists",
        });
    }

    const createdUser = await createUserService(user);
    denoDB.close();

    return createdUser.ok
        ? new Ok<HttpResult>({
            status: 201,
            message: "User created",
        })
        : new Err<HttpResult>({
            status: 500,
            message: "Error creating user",
        });
}

async function logoutService() {
    return new Ok("Logout successful");
}
