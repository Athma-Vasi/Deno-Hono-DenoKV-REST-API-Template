import { Err, Ok } from "../../ts-results/result.ts";
import { HttpResult, ServicesOutput } from "../../types.ts";
import {
    checkIfValueExistsInDenoDB,
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
    userSchema: UserSchema,
): ServicesOutput<UserRecord> {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const secondaryKey = ["users_by_email", userSchema.email];

        const primaryKeyMaybe = await denoDB.get<string[]>(secondaryKey);
        if (primaryKeyMaybe.value !== null) {
            denoDB.close();
            return new Err<HttpResult>(
                createHttpErrorResult("User already exists", 400),
            );
        }

        const userRecord: UserRecord = {
            id: ulid(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...userSchema,
        };

        const primaryKey = ["users_by_id", userRecord.id];
        const createUserMaybe = await denoDB.set(primaryKey, [userRecord]);
        if (!createUserMaybe.ok) {
            denoDB.close();
            return new Err<HttpResult>(
                createHttpErrorResult("Error creating user", 500),
            );
        }

        const secondaryKeyMaybe = await denoDB.set(secondaryKey, primaryKey);
        denoDB.close();
        if (!secondaryKeyMaybe.ok) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error creating user", 500),
            );
        }

        return new Ok<HttpResult<UserRecord>>(
            createHttpSuccessResult(userRecord, "User created", 201),
        );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error creating user: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

async function getUserByIdService(
    id: string,
): ServicesOutput<UserRecord> {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const primaryKey = ["users_by_id", id];
        const userRecordMaybe = await denoDB.get<UserRecord>(primaryKey);
        denoDB.close();

        if (userRecordMaybe.value === null) {
            return new Err<HttpResult>(
                createHttpErrorResult("User not found", 404),
            );
        }

        return new Ok<HttpResult<UserRecord>>(
            createHttpSuccessResult(userRecordMaybe.value, "User found", 200),
        );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error getting user: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

async function getUserByEmailService(email: string) {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const secondaryKey = ["users_by_email", email];
        const primaryKeyMaybe = await denoDB.get<string[]>(secondaryKey);
        const primaryKey = primaryKeyMaybe.value;
        if (primaryKey === null) {
            denoDB.close();
            return new Err<HttpResult>(
                createHttpErrorResult("User not found", 404),
            );
        }

        const userRecordMaybe = await denoDB.get<UserRecord>(primaryKey);
        denoDB.close();

        if (userRecordMaybe.value === null) {
            return new Err<HttpResult>(
                createHttpErrorResult("User not found", 404),
            );
        }

        return new Ok<HttpResult<UserRecord>>(
            createHttpSuccessResult(userRecordMaybe.value, "User found", 200),
        );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error getting user: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

async function updateUserService(
    { fieldToUpdate, userId, valueToUpdate }: {
        fieldToUpdate: string;
        userId: string;
        valueToUpdate: string;
    },
): ServicesOutput<UserRecord> {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const primaryKey = ["users_by_id", userId];
        const userRecordMaybe = await denoDB.get<UserRecord>(primaryKey);
        const userRecord = userRecordMaybe.value;
        if (userRecord === null) {
            denoDB.close();
            return new Err<HttpResult>(
                createHttpErrorResult("User not found", 404),
            );
        }

        const updatedUserRecord = {
            ...userRecord,
            [fieldToUpdate]: valueToUpdate,
            updated_at: new Date().toISOString(),
        };

        const updateMaybe = await denoDB.set(primaryKey, updatedUserRecord);
        denoDB.close();
        if (!updateMaybe.ok) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error updating user", 500),
            );
        }

        return new Ok<HttpResult<UserRecord>>(
            createHttpSuccessResult(
                updatedUserRecord,
                "User updated",
                200,
            ),
        );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error updating user: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

async function deleteUserService(id: string): ServicesOutput<boolean> {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const primaryKey = ["users_by_id", id];
        const userRecordMaybe = await denoDB.get<UserRecord>(primaryKey);
        const userRecord = userRecordMaybe.value;
        if (userRecord === null) {
            denoDB.close();
            return new Err<HttpResult>(
                createHttpErrorResult("User not found", 404),
            );
        }

        await denoDB.delete(primaryKey);
        denoDB.close();

        return new Ok<HttpResult<boolean>>(
            createHttpSuccessResult(true, "User deleted", 200),
        );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error deleting user: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

export {
    createUserService,
    deleteUserService,
    getUserByIdService,
    updateUserService,
};
