# Core infrastructure: walkthrough and review questions

Private study notes.

## Step by step

1. **Tracer bullet**: a test for `GET /health` driven through `createApp`. This forced the app factory signature (`createApp({ config, logger })`) and the response envelope helper on day one.
2. **Errors**: `AppError(status, code, message, details?)` and a single error middleware. Unknown routes flow into it as `NOT_FOUND`. Express identifies an error handler by its four parameters, which is why the unused `_next` stays.
3. **Unexpected errors**: anything that is not an `AppError` is logged (error plus request id) and answered with a fixed generic 500.
4. **Validation errors**: Zod errors are translated to 400 with `details: [{ path, message }]`.
5. **Body handling**: `express.json({ limit: "100kb" })`. body-parser errors carry a `type` string (`entity.parse.failed`, `entity.too.large`), mapped to 400 `INVALID_JSON` and 413 `PAYLOAD_TOO_LARGE`.
6. **helmet and CORS**: helmet defaults; CORS is one exact origin with credentials.
7. **`validate` middleware**: parses and replaces `body`/`query`/`params`. Express 5 made `req.query` a getter, so assignment throws; the middleware redefines the property on the request instance.
8. **Rate limiter**: wraps express-rate-limit, but its handler forwards an `AppError` so the 429 uses the same envelope. Sends standard `RateLimit` headers and `Retry-After`.
9. **Config**: `loadConfig(env)` is pure. Zod validates and coerces; `APP_URL` is reduced to its origin; errors list names only.
10. **Logger**: pino with redaction paths generated from a key list at several depths.
11. **Request logging**: pino-http with a server-generated request id and slim serializers (path only, status only).
12. **Entrypoint**: `server.ts` loads config, exits 1 on `ConfigError`, handles SIGTERM/SIGINT.

## Likely review questions

**1. Why a factory (`createApp`) instead of exporting a configured app?**
So tests can build an app with fakes and no environment, and nothing happens at import time. Collaborators are passed in, which gives NestJS-style testability without a DI container (ADR-0001).

**2. Why is `loadConfig` a function of `env` instead of reading `process.env` itself?**
A pure function is trivial to test (pass any object), and the module has no hidden global input. `server.ts` is the only place that touches `process.env`.

**3. Why must config errors never include values?**
The invalid value might be a secret that was pasted into the wrong variable; the message ends up in deploy logs. There is a test with a sentinel value proving it is not echoed.

**4. How do you stop secrets reaching logs?**
Two layers. The request logger only serializes method, path and status, so headers and bodies are never emitted. On top of that, pino redaction censors known sensitive keys at several nesting depths. A test logs nested secrets and asserts none appear in the output.

**5. Why strip the query string from logged URLs?**
Query strings can carry tokens or personal data, and they would otherwise be written to logs that are shared and retained.

**6. Why is the request id generated server-side and not taken from the client?**
A client-supplied id can be forged to pollute or correlate logs. The server always generates one, returns it as `X-Request-Id`, and logs it, so a user can quote it in a bug report.

**7. Why return a generic message for 500s?**
Error messages can contain connection strings, SQL, file paths. Clients get a stable code and message; operators get the full error in the log, tied together by the request id.

**8. Why does `/health` not check the database?**
It is a liveness probe: "is the process up". If it failed on a database blip, the platform would restart a healthy process and make an outage worse. A separate readiness check is a listed improvement.

**9. Why is the rate-limit handler forwarding an `AppError` instead of sending JSON directly?**
One place (the error handler) owns the response shape, so the 429 cannot drift from the envelope contract.

**10. What breaks if `TRUST_PROXY` is wrong behind Railway?**
The rate limiter keys on `req.ip`. Without trusting the proxy, every request appears to come from the proxy and all users share one bucket; trusting too many hops lets clients spoof their IP via `X-Forwarded-For` and evade the limiter. Hence a configurable hop count, not a boolean.

**11. Why does `validate` redefine `req.query` rather than assign?**
In Express 5 `req.query` is a getter on the prototype; assignment throws in strict mode. Defining an own property on the request instance shadows it with the parsed value.
