import { Err, Ok } from "../../ts-results/result.ts";
import { HttpResult, ServicesOutput } from "../../types.ts";
import { updateFieldInObject } from "../../utils.ts";
import { UserSchema } from "./user-model.ts";

async function createUserService(
    user: UserSchema,
): ServicesOutput<UserSchema> {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Error opening database",
                status: 500,
            });
        }

        const result = await denoDB.set(["users", user.id], user);
        denoDB.close();

        return result.ok
            ? new Ok<HttpResult<UserSchema>>({
                data: [user],
                kind: "success",
                message: "User created",
                status: 201,
            })
            : new Err<HttpResult>({
                kind: "error",
                message: "Error creating user",
                status: 500,
            });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            message: `Error creating user: ${error ?? "Unknown error"}`,
            status: 500,
        });
    }
}

async function getUserService(
    id: string,
): ServicesOutput<UserSchema> {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Error opening database",
                status: 500,
            });
        }

        const result = await denoDB.get<UserSchema>(["users", id]);
        denoDB.close();
        const user = result.value;

        return user === null
            ? new Err<HttpResult>({
                kind: "error",
                message: "User not found",
                status: 404,
            })
            : new Ok<HttpResult<UserSchema>>({
                data: [user],
                kind: "success",
                message: "User found",
                status: 200,
            });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            message: `Error getting user: ${error ?? "Unknown error"}`,
            status: 500,
        });
    }
}

async function updateUserService(
    { fieldToUpdate, userId, valueToUpdate }: {
        fieldToUpdate: string;
        userId: string;
        valueToUpdate: string;
    },
): ServicesOutput<UserSchema> {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Error opening database",
                status: 500,
            });
        }

        const result = await denoDB.get<UserSchema>(["users", userId]);
        const user = result.value;
        if (user === null) {
            return new Err<HttpResult>({
                kind: "error",
                message: "User not found",
                status: 404,
            });
        }

        const updatedUsers = updateFieldInObject({
            fieldToUpdate,
            object: user,
            valueToUpdate,
        });

        await denoDB.set(["users", userId], updatedUsers);
        denoDB.close();

        return new Ok<HttpResult<UserSchema>>({
            data: [updatedUsers],
            kind: "success",
            message: "User updated",
            status: 200,
        });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            message: `Error updating user: ${error?.name ?? "Unknown error"}`,
            status: 500,
        });
    }
}

async function deleteUserService(id: string): ServicesOutput<string> {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                kind: "error",
                message: "Error opening database",
                status: 500,
            });
        }

        await denoDB.delete(["users", id]);
        denoDB.close();

        return new Ok<HttpResult<string>>({
            data: [id],
            kind: "success",
            message: "User deleted",
            status: 200,
        });
    } catch (error) {
        return new Err<HttpResult>({
            kind: "error",
            message: `Error deleting user: ${error?.name ?? "Unknown error"}`,
            status: 500,
        });
    }
}

export {
    createUserService,
    deleteUserService,
    getUserService,
    updateUserService,
};
