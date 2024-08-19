type UserSchema = {
    id: string;
    name: string;
    email: string;
    password: string;
    address_line: string;
    city: string;
    province: string;
    created_at: Date;
    updated_at: Date;
};

export type { UserSchema };
