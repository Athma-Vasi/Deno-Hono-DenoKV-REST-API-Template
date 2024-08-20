type HttpResult = {
    status: number;
    message: string;
};

type JWTPayload = {
    userId: string;
    email: string;
    exp: number;
    nbf: number;
    iat: number;
};

export type { HttpResult, JWTPayload };
