import { Err, Ok } from "../../ts-results/result.ts";
import { HttpResult, ServicesOutput } from "../../types.ts";
import { createHttpErrorResult, createHttpSuccessResult } from "../../utils.ts";
import { UserRecord, UserSchema } from "./types.ts";
import { ulid } from "jsr:@std/ulid";

async function createUserService(
    userSchema: UserSchema,
): ServicesOutput<UserRecord> {
    try {
        const userDB = await Deno.openKv("user_db");
        if (userDB === null || userDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const secondaryKey = ["users_by_email", userSchema.email];

        const primaryKeyMaybe = await userDB.get<string[]>(secondaryKey);
        if (primaryKeyMaybe.value !== null) {
            userDB.close();
            return new Err<HttpResult>(
                createHttpErrorResult("User already exists", 400),
            );
        }

        const userRecord: UserRecord = {
            ...userSchema,
            id: ulid(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const primaryKey = ["users", userRecord.id];
        const createUserMaybe = await userDB.set(primaryKey, [userRecord]);
        if (!createUserMaybe.ok) {
            userDB.close();
            return new Err<HttpResult>(
                createHttpErrorResult("Error creating user", 500),
            );
        }

        const secondaryKeyMaybe = await userDB.set(secondaryKey, primaryKey);
        userDB.close();
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
        const userDB = await Deno.openKv("user_db");
        if (userDB === null || userDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const primaryKey = ["users", id];
        const userRecordMaybe = await userDB.get<UserRecord>(primaryKey);
        userDB.close();

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
        const userDB = await Deno.openKv("user_db");
        if (userDB === null || userDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const secondaryKey = ["users_by_email", email];
        const primaryKeyMaybe = await userDB.get<string[]>(secondaryKey);
        const primaryKey = primaryKeyMaybe.value;
        if (primaryKey === null) {
            userDB.close();
            return new Err<HttpResult>(
                createHttpErrorResult("User not found", 404),
            );
        }

        const userRecordMaybe = await userDB.get<UserRecord>(primaryKey);
        userDB.close();

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
        if (fieldToUpdate === "email" || fieldToUpdate === "id") {
            return new Err<HttpResult>(
                createHttpErrorResult(
                    "Cannot update email or id fields",
                    400,
                ),
            );
        }

        const userDB = await Deno.openKv("user_db");
        if (userDB === null || userDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const primaryKey = ["users", userId];
        const userRecordMaybe = await userDB.get<UserRecord>(primaryKey);
        const userRecord = userRecordMaybe.value;
        if (userRecord === null) {
            userDB.close();
            return new Err<HttpResult>(
                createHttpErrorResult("User not found", 404),
            );
        }

        const updatedUserRecord = {
            ...userRecord,
            [fieldToUpdate]: valueToUpdate,
            updated_at: new Date().toISOString(),
        };

        const updateMaybe = await userDB.atomic().set(
            primaryKey,
            updatedUserRecord,
        ).commit();
        userDB.close();

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
        const userDB = await Deno.openKv("user_db");
        if (userDB === null || userDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const primaryKey = ["users", id];
        const userRecordMaybe = await userDB.get<UserRecord>(primaryKey);
        const userRecord = userRecordMaybe.value;
        if (userRecord === null) {
            userDB.close();
            return new Err<HttpResult>(
                createHttpErrorResult("User not found", 404),
            );
        }

        const deleteMaybe = await userDB.atomic().delete(primaryKey).commit();
        userDB.close();
        if (!deleteMaybe.ok) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error deleting user", 500),
            );
        }

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
    getUserByEmailService,
    getUserByIdService,
    updateUserService,
};
