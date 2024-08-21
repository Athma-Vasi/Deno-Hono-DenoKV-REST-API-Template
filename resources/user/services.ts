import { Err, Ok } from "../../ts-results/result.ts";
import { HttpResult, ServicesOutput } from "../../types.ts";
import {
    createHttpErrorResult,
    createHttpSuccessResult,
    openDenoDBAndDeleteValueService,
    openDenoDBAndGetValueService,
    openDenoDBAndSetValueService,
    updateFieldInObject,
} from "../../utils.ts";
import { UserRecord, UserSchema } from "./types.ts";
import { ulid } from "jsr:@std/ulid";

async function createUserService(
    user: UserSchema,
): ServicesOutput<UserSchema> {
    const userRecord: UserRecord = {
        ...user,
        id: ulid(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    const result = await openDenoDBAndSetValueService<UserRecord>(
        "user_db",
        ["users", userRecord.id],
        userRecord,
    );
    if (result.err) {
        return new Err<HttpResult>(
            createHttpErrorResult("Error creating user", 500),
        );
    }

    return new Ok<HttpResult<UserRecord>>(
        createHttpSuccessResult(userRecord, "User created", 201),
    );
}

async function getUserService(
    id: string,
): ServicesOutput<UserSchema> {
    const result = await openDenoDBAndGetValueService<UserSchema>(
        "user_db",
        ["users", id],
    );
    if (result.err) {
        return new Err<HttpResult>(
            createHttpErrorResult("User not found", 404),
        );
    }

    return new Ok<HttpResult<UserSchema>>(
        createHttpSuccessResult(
            result.safeUnwrap().data[0],
            "User found",
            200,
        ),
    );
}

async function updateUserService(
    { fieldToUpdate, userId, valueToUpdate }: {
        fieldToUpdate: string;
        userId: string;
        valueToUpdate: string;
    },
): ServicesOutput<UserSchema> {
    const getResult = await openDenoDBAndGetValueService<UserSchema>(
        "user_db",
        ["users", userId],
    );
    if (getResult.err) {
        return new Err<HttpResult>(
            createHttpErrorResult("User not found", 404),
        );
    }

    const updatedUsers = updateFieldInObject({
        fieldToUpdate,
        object: getResult.safeUnwrap().data[0],
        valueToUpdate,
    });

    const setResult = await openDenoDBAndSetValueService<UserSchema>(
        "user_db",
        ["users", userId],
        updatedUsers,
    );
    if (setResult.err) {
        return new Err<HttpResult>(
            createHttpErrorResult("Error updating user", 500),
        );
    }

    return new Ok<HttpResult<UserSchema>>(
        createHttpSuccessResult(updatedUsers, "User updated", 200),
    );
}

async function deleteUserService(id: string): ServicesOutput<boolean> {
    const result = await openDenoDBAndDeleteValueService("user_db", [
        "users",
        id,
    ]);
    if (result.err) {
        return new Err<HttpResult>(
            createHttpErrorResult("Error deleting user", 500),
        );
    }

    return new Ok<HttpResult<boolean>>(
        createHttpSuccessResult(true, "User deleted", 200),
    );
}

export {
    createUserService,
    deleteUserService,
    getUserService,
    updateUserService,
};
