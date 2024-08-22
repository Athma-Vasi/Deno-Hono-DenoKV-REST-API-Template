import { Context } from "hono";
import { ErrImpl, OkImpl } from "./ts-results/result.ts";

type HttpResult<Data extends unknown = unknown> = {
    data: [Data];
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

export type { HttpResult, ServicesOutput };
