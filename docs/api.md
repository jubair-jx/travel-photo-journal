# API reference

Base URL: the API root (no path prefix). In the web app, the same endpoints are reached through the `/api/*` proxy.

## Conventions

### Success

```json
{ "success": true, "data": <payload> }
```

`201` for creates, `200` otherwise. A delete returns `200` with `"data": null`.

### Error

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid request", "details": [] }
}
```

`details` is present only when there is something structured to report (currently validation failures).

### Error codes

| Status | Code                | When                                                                      |
| ------ | ------------------- | ------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`  | Input failed schema validation. `details` is `[{ path, message }]`.       |
| 400    | `INVALID_JSON`      | Request body is not parseable JSON.                                       |
| 404    | `NOT_FOUND`         | No such route (or, for photos, no such photo owned by the caller).        |
| 413    | `PAYLOAD_TOO_LARGE` | JSON body over 100 KB.                                                    |
| 429    | `RATE_LIMITED`      | Rate limit exceeded. `Retry-After` header gives seconds until reset.      |
| 500    | `INTERNAL_ERROR`    | Unexpected failure. The message is always generic; details go to the log. |

Codes for later slices (`EMAIL_TAKEN`, `EMAIL_NOT_VERIFIED`, `TOTP_REQUIRED`, upload errors, and so on) are added with the endpoints that use them.

### Headers

- Every response carries `X-Request-Id`. Quote it when reporting a problem; the same id appears in the server log line for that request.
- Rate-limited routes send standard `RateLimit` headers.
- CORS allows exactly the web app origin, with credentials.

## Endpoints

### GET /health

Liveness check. Does not touch the database, so a database outage does not take the process out of rotation.

- **Auth:** none
- **200:** `{ "success": true, "data": { "status": "ok" } }`

### POST /auth/register

Creates an **Unverified User** and emails a verification link.

- **Auth:** none. Rate limited (10 per hour per client IP).
- **Body:** `{ "email": string, "password": string }`. The email is trimmed and lowercased; the password is 8 to 128 characters.
- **201:** `{ "success": true, "data": { "email": "me@example.com" } }`
- **400 `VALIDATION_ERROR`:** malformed email or weak password, with field `details`.
- **409 `EMAIL_TAKEN`:** the address is already registered, whatever its letter case (ADR-0008).
- **429 `RATE_LIMITED`**

If the email cannot be sent, the account is still created and the request still returns 201; the failure is logged and `POST /auth/resend-verification` is the recovery path.

### POST /auth/verify-email

Consumes the token from the emailed link and marks the account verified.

- **Auth:** none. Rate limited (30 per 15 minutes per client IP).
- **Body:** `{ "token": string }`
- **200:** `{ "success": true, "data": { "verified": true } }`
- **400 `INVALID_TOKEN`:** the token is unknown, already used, expired, or replaced by a newer one. These cases are deliberately indistinguishable.
- **400 `VALIDATION_ERROR`:** missing token.
- **429 `RATE_LIMITED`**

A token works exactly once; if two requests carry the same token at the same time, one succeeds and the other receives `INVALID_TOKEN`.

### POST /auth/resend-verification

Issues a new verification link to an unverified account.

- **Auth:** none. Rate limited (5 per hour per client IP).
- **Body:** `{ "email": string }`
- **200:** always the same body, whether or not the account exists or is already verified:
  `{ "success": true, "data": { "message": "If an unverified account exists for that email, a new verification link has been sent." } }`
- **400 `VALIDATION_ERROR`**, **429 `RATE_LIMITED`**

For an unverified account, earlier unused links stop working and the new one is emailed. The email is sent in the background so SMTP latency does not reveal whether the account exists; a difference of a few database round trips remains.

## Error codes added

| Status | Code            | When                                                   |
| ------ | --------------- | ------------------------------------------------------ |
| 409    | `EMAIL_TAKEN`   | Registering an address that already has an account.    |
| 400    | `INVALID_TOKEN` | Verification token unknown, used, expired or replaced. |
