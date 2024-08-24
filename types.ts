import { ErrImpl, OkImpl } from "./ts-results/result.ts";
import { JWTPayload } from "jsr:@hono/hono@^4.5.6/utils/jwt/types";

type HttpResult<Data extends unknown = unknown> = {
    data: Data;
    kind: "error" | "success";
    message: string;
    status: number;
    triggerLogout?: boolean;
};

type ServicesOutput<Data extends unknown = unknown> = Promise<
    ErrImpl<HttpResult> | OkImpl<HttpResult<Data>>
>;

type HttpRequestJSONBody = {
    userId: string;
    email: string;
    sessionId: string;
};

type JWTPayload2 = JWTPayload & {
    userId: string;
    sessionId: string;
};

export type { HttpRequestJSONBody, HttpResult, JWTPayload2, ServicesOutput };
