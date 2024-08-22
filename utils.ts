import { Err, Ok } from "./ts-results/result.ts";
import { HttpResult, ServicesOutput } from "./types.ts";

async function openDenoDBService(
    dbName: string,
): ServicesOutput<Deno.Kv> {
    try {
        const denoDB = await Deno.openKv(dbName);
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        return new Ok<HttpResult<Deno.Kv>>(
            createHttpSuccessResult(denoDB, "Database opened"),
        );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error opening database: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

async function openDenoDBAndSetValueService<
    Schema extends unknown = unknown,
    Key extends string | number | boolean | Uint8Array | bigint =
        | string
        | number
        | boolean
        | Uint8Array
        | bigint,
>(
    dbName: string,
    compoundKey: Array<Key>,
    value: Schema,
    expireIn = 1000 * 60 * 60 * 24 * 1, // 1 day
): ServicesOutput<boolean> {
    try {
        const denoDB = await Deno.openKv(dbName);
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const result = await denoDB.set(compoundKey, value, { expireIn });
        denoDB.close();

        return result.ok
            ? new Ok<HttpResult<boolean>>(
                createHttpSuccessResult(true, "Value set", 200),
            )
            : new Err<HttpResult>(
                createHttpErrorResult("Error setting value", 500),
            );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error setting value: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

async function checkIfValueExistsInDenoDB<
    Schema extends Record<string, unknown> = Record<string, unknown>,
    Key extends string | number | boolean | Uint8Array | bigint =
        | string
        | number
        | boolean
        | Uint8Array
        | bigint,
>(
    dbName: string,
    compoundKey: Array<Key>,
): ServicesOutput<boolean> {
    try {
        const denoDB = await Deno.openKv(dbName);
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const result = await denoDB.get<Schema>(compoundKey);
        denoDB.close();

        return result.value === null
            ? new Ok<HttpResult<boolean>>(
                createHttpSuccessResult(false, "Value not found"),
            )
            : new Ok<HttpResult<boolean>>(
                createHttpSuccessResult(true, "Value found"),
            );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error checking if value exists: ${
                    error?.name ?? "Unknown error"
                }`,
                500,
            ),
        );
    }
}

async function openDenoDBAndGetValueService<
    Schema extends unknown = unknown,
    Key extends string | number | boolean | Uint8Array | bigint =
        | string
        | number
        | boolean
        | Uint8Array
        | bigint,
>(
    dbName: string,
    compoundKey: Array<Key>,
): ServicesOutput<Schema> {
    try {
        const denoDB = await Deno.openKv(dbName);
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        const result = await denoDB.get<Schema>(compoundKey);
        denoDB.close();
        const record = result.value;

        return record === null
            ? new Err<HttpResult>(
                createHttpErrorResult("Value not found", 404),
            )
            : new Ok<HttpResult<Schema>>(
                createHttpSuccessResult(record, "Value found"),
            );
    } catch (error) {
        return new Err<HttpResult>(
            createHttpErrorResult(
                `Error getting value: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
}

async function openDenoDBAndDeleteValueService(
    dbName: string,
    compoundKey: Array<string>,
): ServicesOutput<boolean> {
    try {
        const denoDB = await Deno.openKv(dbName);
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>(
                createHttpErrorResult("Error opening database", 500),
            );
        }

        await denoDB.delete(compoundKey);
        denoDB.close();

        return new Ok<HttpResult<boolean>>(
            createHttpSuccessResult(true, "Value deleted"),
        );
    } catch (error) {
        return new Err<HttpResult>(createHttpErrorResult(
            `Error deleting value: ${error?.name ?? "Unknown error"}`,
            500,
        ));
    }
}

function updateFieldInObject<
    Schema extends Record<string, unknown> = Record<string, unknown>,
>(
    fieldValTuples: Array<[string, Schema[keyof Schema]]>,
    object: Schema,
): Schema {
    return Object.entries(object).reduce((acc, [key, val]) => {
        fieldValTuples.forEach(([field, value]) => {
            if (key === field) {
                acc[key] = value;
            }
        });

        acc[key] = val;

        return acc;
    }, Object.create(null));
}

function createHttpErrorResult(
    message = "Unknown error",
    status = 401,
    triggerLogout = false,
): HttpResult<null> {
    return {
        data: [null],
        kind: "error",
        message,
        status,
        triggerLogout,
    };
}

function createHttpSuccessResult<Data extends unknown = unknown>(
    data: Data,
    message = "Successful operation",
    status = 200,
    triggerLogout = false,
): HttpResult<Data> {
    return {
        data: [data],
        kind: "success",
        message,
        status,
        triggerLogout,
    };
}

export {
    checkIfValueExistsInDenoDB,
    createHttpErrorResult,
    createHttpSuccessResult,
    openDenoDBAndDeleteValueService,
    openDenoDBAndGetValueService,
    openDenoDBAndSetValueService,
    openDenoDBService,
    updateFieldInObject,
};
