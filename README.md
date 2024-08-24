# REST API using Deno + Hono + DenoKV + JWT Authentication

Welcome to your new Deno project! This is a simple REST API that uses Deno,
Hono, DenoKV, and JWT authentication. It is intended to be a starting point for
building a more complex application.

[Deno](https://www.deno.com) is a secure runtime for JavaScript and
[TypeScript](https://www.typescriptlang.org/). [Hono](https://hono.dev/) is a
web application framework built on Web Standards. [DenoKV](https://deno.com/kv)
is a key-value store built to store any JavaScript value. [JWT](https://jwt.io/)
is a standard for authentication and is used to sign and verify tokens.

## Getting Started

To get started, you will need to have Deno installed on your machine. You can
install Deno by following the instructions on the
[Deno website](https://deno.land/).

Once you have Deno installed, you can clone this repository and run the
following command to start the server:

```bash
deno --unstable-kv run --watch --allow-net --allow-read --allow-write main.ts
```

This will start the server on `http://localhost:8000`.

## Configuration

The server can be configured using the `.env` file. The following environment
variables are available:

- `REFRESH_TOKEN_SEED`: The seed used to sign the refresh token.
- `ACCESS_TOKEN_SEED`: The seed used to sign the access token.
- `STAGING_URL`: The URL of the staging server.

## Endpoints

The following endpoints are available:

- `POST /auth/login`: Log in with a email and password.
- `POST /auth/register`: Register a new user.
- `POST /auth/logout`: Log out the current user.
- `GET /auth/all`: Get all auth session records.

- `GET /users/all`: Get all users.
- `GET /users/email`: Get a user by email.
- `GET /users/:id`: Get a user by ID.
- `POST /users/:id`: Update a user by ID.
- `DELETE /users/:id`: Delete a user by ID.

## Contributing

If you would like to contribute to this project, please feel free to open a pull
request or an issue. I would love to hear your feedback and suggestions!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file
for more information.
