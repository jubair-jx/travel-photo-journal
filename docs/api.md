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

## Photos

All photo routes require `Authorization: Bearer <accessToken>` and only ever touch the caller's own photos. A photo that belongs to someone else, does not exist, or has a malformed id gets the same `404 NOT_FOUND` ("Photo not found"), so existence is never revealed (ADR-0007).

### Photo object

```json
{
  "id": "uuid",
  "name": "Sunrise at Phewa Lake",
  "location": "Pokhara, Nepal",
  "description": "We paddled out before dawn...",
  "summary": "A short generated summary.",
  "imageUrl": "https://... (signed, expires)",
  "imageMime": "image/png",
  "createdAt": "2026-10-24T14:00:00.000Z",
  "updatedAt": "2026-10-24T14:00:00.000Z"
}
```

`summary` is `null` when it could not be produced. `imageUrl` is a short-lived signed link (15 minutes by default); fetch the photo or list again to get a fresh one. The storage key is never exposed.

### POST /photos

Creates a photo. `multipart/form-data` with the fields `image` (file), `name`, `location`, `description`.

- **Limits:** `name` and `location` 1 to 120 characters, `description` 1 to 2000, all trimmed. Image: JPEG, PNG or WebP, at most 5 MB.
- **201:** the photo object.
- **400 `VALIDATION_ERROR`:** a text field is missing or too long, the image is missing, or a file was sent under a field other than `image`. `details` lists each failing `path`.
- **413 `PAYLOAD_TOO_LARGE`:** the image is over 5 MB.
- **415 `UNSUPPORTED_MEDIA_TYPE`:** the file is not a JPEG, PNG or WebP. The decision is made from the file's own bytes; the filename and `Content-Type` the client sends are ignored.
- **401 `UNAUTHENTICATED`**

A `summary` sent by the client is ignored. The server generates one from the description (summary generation via OpenRouter); if that fails or is switched off, the photo is still saved with `summary: null`.

### GET /photos

Lists the caller's photos, newest first.

- **Query:** `page` (default 1) and `limit` (default 20, maximum 50).
- **200:** `{ "items": [photo], "page": 1, "limit": 20, "total": 42, "totalPages": 3 }`. A page past the end returns an empty `items`.
- **400 `VALIDATION_ERROR`:** a non-numeric or out-of-range `page` or `limit`.

### GET /photos/:id

- **200:** the photo object. **404** if it is not the caller's.

### PUT /photos/:id

Replaces `name`, `location` and `description` (all three required) and optionally the image. `multipart/form-data` like create, with `image` optional.

- **200:** the updated photo.
- The summary is regenerated only if the description changed. If regeneration fails it becomes `null` instead of keeping a summary of the old text. An unchanged description keeps the existing summary.
- A replaced image's old file is deleted after the new one is saved.
- **400**, **413**, **415** as for create; a rejected request changes nothing. **404** if not the caller's; in that case nothing is uploaded or summarized.

### DELETE /photos/:id

- **200:** `{ "success": true, "data": null }`. Deletes the row and then the stored file; if the file cannot be removed the request still succeeds and the failure is logged.
- **404** if not the caller's. Repeating the request gives 404.

### GET /files/photos/... (development driver only)

When `STORAGE_DRIVER=local`, the API serves image bytes itself at the URLs it hands out: `GET /files/<key>?expires=<unix>&signature=<hmac>`. Anything that is not a valid, unexpired link gets `403 INVALID_LINK`; a valid link to a missing file gets 404. With `STORAGE_DRIVER=r2` the links point straight at the bucket and this route does not exist.

## Error codes added (photos)

| Status | Code                     | When                                                   |
| ------ | ------------------------ | ------------------------------------------------------ |
| 413    | `PAYLOAD_TOO_LARGE`      | Image over 5 MB (JSON bodies over 100 KB also use it). |
| 415    | `UNSUPPORTED_MEDIA_TYPE` | Upload is not a JPEG, PNG or WebP.                     |
| 403    | `INVALID_LINK`           | Local-driver image link is tampered with or expired.   |
