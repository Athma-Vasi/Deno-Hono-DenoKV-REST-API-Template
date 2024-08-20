type HttpResult<T extends unknown = unknown> = {
    kind: "error" | "success";
    status: number;
    message: string;
    data?: T;
};

export type { HttpResult };
