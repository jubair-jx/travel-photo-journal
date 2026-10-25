# Deployment

## Topology

| Part     | Where                         | Notes                                                                                                                                                                                                                    |
| -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web      | Vercel                        | `/api/*` is rewritten to the API, so the browser only talks to the web origin and the refresh cookie is same-origin.                                                                                                     |
| API      | Railway (Docker)              | Built from `backend/Dockerfile` with `backend/` as the context. Services do not sleep by default; verify Railway's current trial and plan terms, since a paid plan may be needed if the review falls after a trial ends. |
| Database | Neon Postgres                 | Pooled `DATABASE_URL` for the app, direct `DIRECT_URL` for migrations.                                                                                                                                                   |
| Images   | Neon Object Storage (private) | Accessed through the storage interface; signed URLs only.                                                                                                                                                                |
| Email    | Brevo HTTPS API               | Mailpit (SMTP) locally. Production uses the API because free hosts block SMTP ports.                                                                                                                                     |

Tests run against Postgres in compose and in CI; Neon is not used for tests.

## Container images

- **API** (`backend/Dockerfile`): multi-stage (compile, production dependencies, runtime). Runs as the non-root `node` user with a `/health` healthcheck, fails fast with a readable message if configuration is invalid, and contains the Prisma CLI, schema and migrations because releases run `prisma migrate deploy` from the same image. The size (roughly 700 MB) is dominated by Prisma's migration tooling; a separate migrate image would shrink the runtime image if that ever matters.
- **Web** (`frontend/Dockerfile`): Next.js standalone output, non-root. `API_INTERNAL_URL` is a build argument because Next resolves rewrites at build time.
- Both build in CI on every change.

## Releasing

1. Build and push the images (or let the platform build from the Dockerfile).
2. Run the migrations **before** the new API version takes traffic: `npx prisma migrate deploy` from the image's working directory (`/app`), with `DIRECT_URL` set. On Railway this is the pre-deploy command; in compose it is the `migrate` service.
3. Start the API, then check `GET /health`.

Migrations are forward-only and applied in order; `migrate deploy` never creates or resets a database.

## Deploying the API on Railway

The production image was checked locally the way Railway runs it: `prisma migrate deploy` as the pre-deploy command, then the server started with `PORT` injected, `NODE_ENV=production` and no `.env` file. `/health` answered 200, the process ran as a non-root user, and registration worked even with an unreachable mail server.

1. **New project, Deploy from GitHub repo.** Give Railway access to the repository (it can be private).
2. **Service settings:** Root Directory `backend`; the builder is the Dockerfile in it. `backend/railway.json` already sets the pre-deploy command (`npx prisma migrate deploy`), the health check (`/health`) and the restart policy. If Railway does not pick the file up from a root directory, enter the same three values in the service's Deploy settings.
3. **Variables** (service Variables tab), as listed under Production configuration. `DIRECT_URL` must be the Neon **direct** string (no `-pooler`), because the pre-deploy migration uses it; `DATABASE_URL` is the pooled one.
4. **Networking:** generate a public domain. That URL, `https://<name>.up.railway.app`, is what Vercel gets as `API_INTERNAL_URL`.
5. **Order:** deploy the API first, then set `API_INTERNAL_URL` on Vercel and deploy the web app, then set `APP_URL` on Railway to the Vercel URL and redeploy the API.
6. **Check:** open `<railway-url>/health`, then register, verify the email, sign in, reload the page (you must stay signed in), upload a photo.

**Cost:** a new Railway account gets a one-time $5 trial credit that expires after 30 days; after that the Hobby plan is $5 a month including $5 of usage, enough for this small API. The service does not sleep. The review needs the link up until the reviewers reply, so plan for the paid plan.

## Production configuration

Never commit any of these. Set them in the platform dashboards.

**API (Railway):** `NODE_ENV=production`, `PORT` (Railway sets it), `APP_URL` (the Vercel URL), `TRUST_PROXY=2` (Vercel, then Railway's edge; check that logged client IPs look right), `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `TOTP_ENC_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `ANTHROPIC_API_KEY` (or `OPENROUTER_API_KEY`), `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODELS`. Optionally `REFRESH_COOKIE_PATH=/api/auth`.

**Web (Vercel):** `API_INTERNAL_URL` set to the API's public URL, and set **before the build**, since rewrites are resolved then. Project root directory `frontend`.

Secret handling: `JWT_SECRET` must be 32 or more characters, `TOTP_ENC_KEY` exactly 32 random bytes in base64. Losing `TOTP_ENC_KEY` makes stored 2FA secrets unreadable, so treat it like a database credential.

## Cold starts and the live link

The Railway service stays running, so the API itself has no cold start. The Neon database does: on the free plan its compute suspends after a few minutes idle, and the first query after that can take a few seconds. The web app tolerates this (the refresh waits up to 20 seconds and retries are offered), but warm up the live site before sharing the link.

## Things to confirm on the live site

- **Upload size through Vercel's rewrite.** Vercel documents a 4.5 MB request body limit for its serverless functions. Rewrites to an external origin are normally proxied without that limit, but if a 10 MB upload fails with a 413 from Vercel (not from the API), lower the client-side image limit to 4 MB (and the API limit with it), or send uploads straight to the API with CORS enabled.
- **Cookies.** The refresh cookie must be set on the Vercel domain, Secure, httpOnly, `SameSite=Lax`.
- **Email.** Set `BREVO_API_KEY` and `MAIL_FROM`; the sender address must be verified in Brevo (Senders & IP). Free web hosts (Render's included) block outbound SMTP on ports 25, 465 and 587, which is why production mail goes over the HTTPS API; `SMTP_*` is only needed when `BREVO_API_KEY` is not set.
