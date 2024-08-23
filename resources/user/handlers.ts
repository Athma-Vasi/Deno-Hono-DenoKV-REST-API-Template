import { Context } from "hono";
import { createUserService, getUserByIdService } from "./services.ts";
import { UserRecord, UserSchema } from "./types.ts";
import { HttpResult } from "../../types.ts";
import { createHttpErrorResult, createHttpSuccessResult } from "../../utils.ts";

async function getAllUsersIdHandler(c: Context) {
    const userDB = await Deno.openKv("user_db");
    if (userDB === null || userDB === undefined) {
        return c.json<HttpResult>(
            createHttpErrorResult("Error opening database", 500),
        );
    }

    const users = [] as unknown[];
    for await (
        const result of userDB.list({ prefix: ["users"] }, { limit: 10 })
    ) {
        users.push(result.value);
    }
    return c.json<HttpResult>(
        createHttpSuccessResult(users, "Users found", 200),
    );
}

async function createUserHandler(c: Context) {
    const user = await c.req.json<UserSchema>();
    console.group("createUserHandler");
    console.log(user);
    console.groupEnd();

    if (!user) {
        console.error("User not found");
    }
    const result = await createUserService(user);

    if (result.ok) {
        return c.json(result);
    } else {
        console.error(result.toString());
    }
}

async function getUserByIdHandler(c: Context) {
    console.log("inside getUserHandler");
    const userId = c.req.query("userId") ?? "";

    const result = await getUserByIdService(userId);

    console.group("getUserHandler");
    console.log(result);
    console.groupEnd();

    if (result.ok) {
        return c.json(result);
    } else {
        console.error(result.toString());
    }
}

async function deleteUserHandler(c: Context) {
    return c.text("Delete User");
}

async function updateUserHandler(c: Context) {
    return c.text("Update User");
}

export {
    createUserHandler,
    deleteUserHandler,
    getAllUsersIdHandler,
    getUserByIdHandler,
    updateUserHandler,
};
