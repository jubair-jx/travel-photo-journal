# Architecture

## Shape

An npm-workspaces monorepo: `backend` (Express, TypeScript, Prisma) and `frontend` (Next.js). The web app proxies `/api/*` to the API so that the refresh cookie is same-origin (ADR-0004).

## API composition

`createApp(deps)` is the single place the application is assembled. It receives its collaborators as arguments (config, logger, Prisma client and mailer so far; storage and summarizer in the photos slice) and returns an Express app. Nothing reads `process.env` or constructs a client at import time, so tests build an app with fakes and production builds one with real implementations (ADR-0001).

`server.ts` is the only entrypoint: it loads and validates configuration, builds the logger and app, listens, and shuts down on SIGTERM/SIGINT.

### Request pipeline

Order matters; each step relies on the ones before it.

1. **Request logger**: assigns a fresh request id (also sent as `X-Request-Id`) and logs one line per request with method, path and status only.
2. **helmet**: security headers.
3. **CORS**: exact match on the web app origin, with credentials.
4. **JSON body parser**: 100 KB limit. Parse and size failures are translated to 400/413 envelopes by the error handler.
5. **Routes**: feature modules (health today; auth and photos in later slices).
6. **Not-found handler**: unmatched routes become a `NOT_FOUND` error.
7. **Error handler**: the only place that turns an exception into a response.

### Errors

Code anywhere in the request path throws or forwards an `AppError(status, code, message, details?)`. The error handler also recognises Zod validation errors (400) and body-parser errors (400/413). Anything else is logged with the request id and answered with a generic 500, so internals never reach a client.

### Validation

`validate(schema, source)` parses `body`, `query` or `params`, replaces the request's value with the parsed result (so handlers see coerced, trimmed, stripped data), and forwards failures to the error handler. Unknown fields are dropped by the schemas, which is how a client-supplied photo summary is ignored.

### Configuration

`loadConfig(env)` validates an env object and returns a typed config. It takes the env as an argument, so it is tested without touching `process.env`. On failure it throws an error naming the variables and reasons, never the values. Each slice adds the variables it needs.

### Logging

pino, with path-based redaction for password, token, authorization, cookie and Set-Cookie fields at several depths, and request/response serializers that log only what is needed. Redaction is the second line of defence; the serializers are the first.

## Feature modules

Each module owns its HTTP surface and business logic:

- `*.routes.ts` wires paths to middleware (rate limit, validation) and controller handlers.
- `*.controller.ts` is thin: it takes the already-validated request body, calls the service and writes the response envelope.
- `*.service.ts` holds the behavior. It is built by a factory that receives its dependencies (database, mailer, config, logger), so it has no hidden globals.
- `*.schema.ts` holds the Zod input schemas; they are the single definition of what each endpoint accepts.

`auth` today covers registration (`auth.service`: register, verify-email, resend-verification) and sessions (`session.service`: login, refresh, logout). Two-factor setup and confirmation live in `two-factor.service`; TOTP mechanics (secret, QR code, code check) are in `lib/totp`, and secret encryption is in `lib/crypto`. Cross-cutting authentication is the `requireAuth` middleware, which verifies the bearer access token and sets `req.auth.userId` for protected routes.

## Data and mail

Prisma is the only database access (pooled URL at runtime, direct URL for migrations; see backend/database.md). Outbound email goes through the `Mailer` interface; the SMTP implementation targets Mailpit locally and Brevo in production, and tests substitute a recording fake.

`photos` provides create, list, read, update and delete for a user's own photos; its service takes the storage and summarizer interfaces as dependencies.

## Storage and summaries

`StorageService` (upload, delete, getSignedUrl) has two drivers selected by `STORAGE_DRIVER`: local disk for development and tests (files served by the API through HMAC-signed, expiring links) and Cloudflare R2 for production (presigned GET links). `Summarizer` has an OpenRouter implementation that tries the configured model and then the fallback list inside one 8-second deadline, and a disabled implementation used when no API key or model is configured, so the whole application runs without any external credentials.

The upload pipeline is: multer (memory, 5 MB, one file), then a magic-byte check, then the service. Create runs summarization and the storage upload concurrently and inserts one row; if the insert fails the uploaded object is removed.

## Web application

See [frontend/architecture.md](frontend/architecture.md).

## Testing approach

Vitest and supertest drive the app through HTTP. Infrastructure modules are tested through their public interface (a throwaway Express app for middleware, a captured stream for the logger). Integration tests run against a real Postgres (compose locally, a service container in CI); global setup migrates it, and each test resets the tables through Prisma. The mailer is replaced by a fake that records messages, so tests read verification links the way a user would. Selected tests were mutation-checked (breaking the code on purpose) to confirm they fail when the behavior breaks.
