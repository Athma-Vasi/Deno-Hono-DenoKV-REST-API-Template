import { Context } from "hono";
import {
    createUserService,
    getAllUsersService,
    getUserByIdService,
} from "./services.ts";
import { UserSchema } from "./types.ts";

async function getAllUsersHandler(c: Context) {
    const users = await getAllUsersService();
    console.log(`\n`);
    console.log("getAllUsersHandler");
    console.log("users", users);
    console.groupEnd();

    if (users.ok) {
        return c.json(users);
    } else {
        console.error(users.toString());
    }
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
    getAllUsersHandler,
    getUserByIdHandler,
    updateUserHandler,
};
