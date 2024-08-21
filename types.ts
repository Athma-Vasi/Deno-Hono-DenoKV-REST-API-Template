import { ErrImpl, OkImpl } from "./ts-results/result.ts";

type HttpResult<Data extends unknown = unknown> = {
    data?: Array<Data>;
    kind: "error" | "success";
    message: string;
    status: number;
};

type ServicesOutput<Data extends unknown = unknown> = Promise<
    ErrImpl<HttpResult> | OkImpl<HttpResult<Data>>
>;

export type { HttpResult, ServicesOutput };
