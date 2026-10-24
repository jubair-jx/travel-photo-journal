# Security

Status of each control. Items marked _planned_ are delivered with the slice named in brackets.

| Control                                                    | Status                                                                                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets never logged                                       | Done. pino redaction (multi-depth) plus serializers that log only method, path, status.                                                                           |
| Query strings kept out of logs                             | Done. Request log records the path only.                                                                                                                          |
| Fail-fast configuration, values never echoed               | Done. Errors list variable names and reasons only.                                                                                                                |
| helmet                                                     | Done.                                                                                                                                                             |
| Strict CORS from `APP_URL`                                 | Done. Exact origin, credentials enabled; no wildcard.                                                                                                             |
| Body size limits                                           | Done for JSON (100 KB). Uploads: 5 MB _(photos)_.                                                                                                                 |
| Input validation with Zod on every input                   | Mechanism done; applied per route as endpoints are added.                                                                                                         |
| Generic 500 responses                                      | Done. Internals go to the log with a request id, never to the client.                                                                                             |
| argon2id password hashing                                  | Done (OWASP minimum profile: 19 MiB, 2 passes, 1 lane).                                                                                                           |
| Verification tokens hashed at rest, single use, expiring   | Done. 256-bit random, SHA-256 stored, atomic claim, 24 hours.                                                                                                     |
| Rate limits on register, verify and resend                 | Done. Per client IP; `TRUST_PROXY` decides whether `X-Forwarded-For` is believed.                                                                                 |
| Account enumeration                                        | Register discloses (ADR-0008, rate limited). Resend does not: identical body, mail sent in background.                                                            |
| JWT: HS256 pinned, issuer and audience checked, 15 minutes | Done. Tests cover wrong secret, expiry, issuer, audience, HS512 and `alg: none`.                                                                                  |
| Generic login errors, constant-ish failure path            | Done. Identical 401 for unknown email and wrong password; an equalizing hash runs for unknown emails; "unverified" is revealed only after the password is proven. |
| Refresh rotation with reuse detection                      | Done. Single-use, hashed at rest, replay revokes the session (ADR-0009).                                                                                          |
| Refresh cookie                                             | Done. httpOnly, Secure in production, SameSite=Lax, configurable path.                                                                                            |
| CSRF on refresh and logout                                 | SameSite=Lax blocks cross-site POSTs; CORS is a single origin.                                                                                                    |
| TOTP secret encryption                                     | _planned_ (2FA)                                                                                                                                                   |
| Ownership checks, upload magic bytes, private storage      | _planned_ (photos)                                                                                                                                                |
| Dependency audit in CI                                     | Done. `npm audit --audit-level=high` runs on every change.                                                                                                        |
| Prisma only, no raw SQL                                    | Done. No raw queries in application or test code.                                                                                                                 |

## Notes

- The request id is generated server-side. A client-supplied id is ignored so that log lines cannot be forged or correlated across users.
- `trust proxy` is configurable (`TRUST_PROXY`) because rate limiting keys on the client IP; behind a proxy without it, every client would appear to share the proxy's address.
