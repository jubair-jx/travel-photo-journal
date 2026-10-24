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
