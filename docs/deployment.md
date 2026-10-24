# Deployment

## Topology

| Part     | Where                          | Notes                                                                                                                                                                                                                          |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web      | Vercel                         | `/api/*` is rewritten to the API, so the browser only talks to the web origin and the refresh cookie is same-origin.                                                                                                           |
| API      | Railway (Docker)               | Built from `apps/api/Dockerfile` with the repository root as context. Services do not sleep by default; verify Railway's current trial and plan terms, since a paid plan may be needed if the review falls after a trial ends. |
| Database | Neon Postgres                  | Pooled `DATABASE_URL` for the app, direct `DIRECT_URL` for migrations.                                                                                                                                                         |
| Images   | Cloudflare R2 (private bucket) | Accessed through the storage interface; signed URLs only.                                                                                                                                                                      |
| Email    | Brevo SMTP                     | Mailpit locally.                                                                                                                                                                                                               |

Tests run against Postgres in compose and in CI; Neon is not used for tests.

## Container images

- **API** (`apps/api/Dockerfile`): multi-stage (compile, production dependencies, runtime). Runs as the non-root `node` user with a `/health` healthcheck, fails fast with a readable message if configuration is invalid, and contains the Prisma CLI, schema and migrations because releases run `prisma migrate deploy` from the same image. The size (roughly 700 MB) is dominated by Prisma's migration tooling; a separate migrate image would shrink the runtime image if that ever matters.
- **Web** (`apps/web/Dockerfile`): Next.js standalone output, non-root. `API_INTERNAL_URL` is a build argument because Next resolves rewrites at build time.
- Both build in CI on every change.

## Releasing

1. Build and push the images (or let the platform build from the Dockerfile).
2. Run the migrations **before** the new API version takes traffic: `npx prisma migrate deploy` from the image's working directory (`/app/apps/api`), with `DIRECT_URL` set. On Railway this is the pre-deploy command; in compose it is the `migrate` service.
3. Start the API, then check `GET /health`.

Migrations are forward-only and applied in order; `migrate deploy` never creates or resets a database.

## Production configuration

Never commit any of these. Set them in the platform dashboards.

**API (Railway):** `NODE_ENV=production`, `PORT` (Railway sets it), `APP_URL` (the Vercel URL), `TRUST_PROXY=1`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `TOTP_ENC_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `STORAGE_DRIVER=r2`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODELS`. Optionally `REFRESH_COOKIE_PATH=/api/auth`.

**Web (Vercel):** `API_INTERNAL_URL` set to the API's public URL, and set **before the build**, since rewrites are resolved then. Project root directory `apps/web`.

Secret handling: `JWT_SECRET` must be 32 or more characters, `TOTP_ENC_KEY` exactly 32 random bytes in base64. Losing `TOTP_ENC_KEY` makes stored 2FA secrets unreadable, so treat it like a database credential.

## Cold starts and the live link

If the API sleeps (a platform choice, not the default on Railway), the first request after idle can take tens of seconds. For the review window, use an always-on plan, or a keep-warm ping on `/health` every 10 minutes.

## Things to confirm on the live site

- **Upload size through Vercel's rewrite.** Vercel documents a 4.5 MB request body limit for its serverless functions. Rewrites to an external origin are normally proxied without that limit, but if a 5 MB upload fails with a 413 from Vercel (not from the API), lower the client-side image limit to 4 MB, or send uploads straight to the API with CORS enabled.
- **Cookies.** The refresh cookie must be set on the Vercel domain, Secure, httpOnly, `SameSite=Lax`.
- **Email.** Brevo requires a verified sender address; `MAIL_FROM` must match it.
