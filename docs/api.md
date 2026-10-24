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

### POST /auth/login

Signs in a verified user.

- **Auth:** none. Rate limited (10 per 15 minutes per client IP).
- **Body:** `{ "email": string, "password": string }`. The email is trimmed and lowercased.
- **200:** `{ "success": true, "data": { "accessToken": string, "expiresIn": 900, "user": { "id": string, "email": string } } }` and a `Set-Cookie` for the refresh token (httpOnly, `SameSite=Lax`, `Secure` in production, 7 days).
- **401 `INVALID_CREDENTIALS`:** unknown email or wrong password. The two cases are identical in body and (approximately) in response time, and neither sets a cookie.
- **403 `EMAIL_NOT_VERIFIED`:** the password was correct but the address is not yet verified. Only returned after the password check, so it does not reveal which emails have accounts.
- **400 `VALIDATION_ERROR`**, **429 `RATE_LIMITED`**

The access token goes in `Authorization: Bearer <token>` on protected routes. It is a 15 minute HS256 JWT with issuer and audience claims.

### POST /auth/refresh

Exchanges the refresh cookie for a new access token and a new refresh cookie.

- **Auth:** the refresh cookie; no body. Rate limited (120 per 15 minutes per client IP).
- **200:** same body as login. The old refresh token is retired.
- **401 `INVALID_REFRESH_TOKEN`:** missing, unknown, expired or already-used cookie. The response clears the cookie. If the token had already been used, every token issued after it in that session is revoked as well (theft response; see ADR-0009).

### POST /auth/logout

Ends the current session.

- **Auth:** the refresh cookie, if present. Rate limited like refresh.
- **200:** `{ "success": true, "data": null }` and a cleared cookie. Always succeeds, including with no cookie or an unknown one, so it is safe to call twice. Other sessions of the same user (other devices) are untouched.

### Protected routes

Routes behind `requireAuth` expect `Authorization: Bearer <accessToken>`. Anything else (missing header, wrong scheme, bad signature, expired, wrong issuer or audience, wrong algorithm) gets the same `401 UNAUTHENTICATED`.

## Error codes added (login and sessions)

| Status | Code                    | When                                                         |
| ------ | ----------------------- | ------------------------------------------------------------ |
| 401    | `INVALID_CREDENTIALS`   | Unknown email or wrong password.                             |
| 403    | `EMAIL_NOT_VERIFIED`    | Correct password, unverified address.                        |
| 401    | `INVALID_REFRESH_TOKEN` | Refresh cookie missing, unknown, expired, revoked or reused. |
| 401    | `UNAUTHENTICATED`       | Missing or invalid access token on a protected route.        |

### POST /auth/2fa/setup

Starts two-factor setup for the signed-in user.

- **Auth:** `Authorization: Bearer <accessToken>`. Rate limited (10 per 15 minutes per client IP).
- **200:** `{ "success": true, "data": { "qrCodeDataUrl": "data:image/png;base64,...", "manualKey": "BASE32SECRET" } }`. The QR code encodes an `otpauth://` entry labelled `Travel Photo Journal:<email>`; `manualKey` is the same secret for typing by hand.
- **409 `TWO_FACTOR_ALREADY_ENABLED`:** 2FA is already on. The existing secret is not replaced.
- **401 `UNAUTHENTICATED`**, **429 `RATE_LIMITED`**

The secret is stored encrypted and **not yet active**. Calling setup again before confirming replaces the pending secret.

### POST /auth/2fa/verify

Confirms the first code from the authenticator app and switches 2FA on.

- **Auth:** bearer access token. Rate limited like setup.
- **Body:** `{ "code": "123456" }` (exactly six digits)
- **200:** `{ "success": true, "data": { "enabled": true } }`
- **400 `INVALID_TOTP_CODE`:** the code does not match. Nothing changes, so a typo cannot lock anyone out.
- **400 `TWO_FACTOR_NOT_SET_UP`:** no pending secret; call setup first.
- **400 `VALIDATION_ERROR`:** the code is not six digits.
- **409 `TWO_FACTOR_ALREADY_ENABLED`**, **401 `UNAUTHENTICATED`**, **429 `RATE_LIMITED`**

A code is accepted if it is the current one or the one from the adjacent 30-second step (clock drift).

### Login with 2FA

`POST /auth/login` accepts an optional `totpCode` (six digits). Once 2FA is enabled:

- correct password, no code: `401 TOTP_REQUIRED`
- correct password, wrong code, or any wrong password: `401 INVALID_CREDENTIALS`, identical to an ordinary failed login
- correct password and code: the normal 200 response

Before 2FA is confirmed, login behaves exactly as before.

## Error codes added (2FA)

| Status | Code                         | When                                          |
| ------ | ---------------------------- | --------------------------------------------- |
| 401    | `TOTP_REQUIRED`              | Right password, 2FA enabled, no code sent.    |
| 400    | `INVALID_TOTP_CODE`          | Setup confirmation code does not match.       |
| 400    | `TWO_FACTOR_NOT_SET_UP`      | Confirming before calling setup.              |
| 409    | `TWO_FACTOR_ALREADY_ENABLED` | Setup or confirmation when 2FA is already on. |
