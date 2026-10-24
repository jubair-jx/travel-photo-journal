# Security

Status of each control. Items marked _planned_ are delivered with the slice named in brackets.

| Control                                                   | Status                                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Secrets never logged                                      | Done. pino redaction (multi-depth) plus serializers that log only method, path, status. |
| Query strings kept out of logs                            | Done. Request log records the path only.                                                |
| Fail-fast configuration, values never echoed              | Done. Errors list variable names and reasons only.                                      |
| helmet                                                    | Done.                                                                                   |
| Strict CORS from `APP_URL`                                | Done. Exact origin, credentials enabled; no wildcard.                                   |
| Body size limits                                          | Done for JSON (100 KB). Uploads: 5 MB _(photos)_.                                       |
| Input validation with Zod on every input                  | Mechanism done; applied per route as endpoints are added.                               |
| Generic 500 responses                                     | Done. Internals go to the log with a request id, never to the client.                   |
| Rate limiting                                             | Mechanism done; applied to auth routes _(register, login)_.                             |
| argon2id, hashed tokens, JWT pinning, generic auth errors | _planned_ (register, login)                                                             |
| TOTP secret encryption                                    | _planned_ (2FA)                                                                         |
| Ownership checks, upload magic bytes, private storage     | _planned_ (photos)                                                                      |
| Dependency audit in CI                                    | Done. `npm audit --audit-level=high` runs on every change.                              |
| Prisma only, no raw SQL                                   | Convention from the first model onward.                                                 |

## Notes

- The request id is generated server-side. A client-supplied id is ignored so that log lines cannot be forged or correlated across users.
- `trust proxy` is configurable (`TRUST_PROXY`) because rate limiting keys on the client IP; behind a proxy without it, every client would appear to share the proxy's address.
