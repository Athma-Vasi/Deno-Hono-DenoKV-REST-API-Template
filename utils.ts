import { HttpResult } from "./types.ts";

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

export { createHttpErrorResult, createHttpSuccessResult };
