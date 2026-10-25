# Deployment

The live app runs on free tiers:

| Part                       | Where                         | Notes                                                                                                                |
| -------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Web                        | Vercel                        | `/api/*` is rewritten to the API, so the browser only talks to the web origin and the refresh cookie is same-origin. |
| API                        | Render (Docker, free plan)    | Built from `backend/Dockerfile`. Sleeps when idle, see [Free-plan behaviour](#free-plan-behaviour).                  |
| Database                   | Neon Postgres                 | Pooled `DATABASE_URL` for the app, direct `DIRECT_URL` for migrations.                                               |
| Images                     | Neon Object Storage (private) | Accessed through the storage interface; signed URLs only.                                                            |
| Email                      | Resend HTTPS API              | Mailpit (SMTP) locally. Production uses the API because free hosts block the SMTP ports (25, 465, 587).              |
| Summaries and descriptions | Anthropic API                 | The cheapest model; roughly $0.0002 per photo with both features.                                                    |

Tests run against Postgres in compose and in CI; Neon is not used for tests.

## Container images

- **API** (`backend/Dockerfile`): multi-stage (compile, production dependencies, runtime). Runs as the non-root `node` user with a `/health` healthcheck, fails fast with a readable message if configuration is invalid, and contains the Prisma CLI, schema and migrations so `prisma migrate deploy` can run from the same image.
- **Web** (`frontend/Dockerfile`): Next.js standalone output, non-root. `API_INTERNAL_URL` is a build argument because Next resolves rewrites at build time. On Vercel the platform builds the app itself and the Dockerfile is not used.
- Both build in CI on every change.

## Releasing

1. **Apply database migrations first**, from a machine with the direct connection string (Render's free plan has no pre-deploy command):
   ```bash
   cd backend
   DIRECT_URL=<direct neon url> npx prisma migrate deploy
   ```
   Migrations are forward-only and applied in order; `migrate deploy` never creates or resets a database.
2. Merge to `main`. Render and Vercel both deploy from `main` automatically.
3. Check `GET /health` on the API, then sign in on the web app.

## Setting up the API on Render

1. **New → Web Service**, connect the GitHub repository (it can be private).
2. Settings:
   - **Language:** Docker (it cannot be changed after creation)
   - **Region:** Ohio, the same region as the Neon database
   - **Root Directory:** empty
   - **Dockerfile Path:** `backend/Dockerfile`
   - **Docker Build Context Directory:** `backend`
   - **Instance type:** Free
   - **Health Check Path:** `/health`
3. **Environment:** add the variables below, then deploy.

### API environment variables

Never commit these. Set them in the Render dashboard. The names and meanings are also listed in [development.md](development.md) and in `backend/.env.example`.

| Variable                                                                                                   | Value in production                                                                                         |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                                 | `production` (makes the refresh cookie `Secure`)                                                            |
| `APP_URL`                                                                                                  | The Vercel URL, no trailing slash; used for CORS and the links in emails                                    |
| `TRUST_PROXY`                                                                                              | `2` (Vercel, then Render); client IPs drive rate limiting                                                   |
| `REFRESH_COOKIE_PATH`                                                                                      | `/api/auth` (the path the browser sees behind the proxy)                                                    |
| `DATABASE_URL`                                                                                             | Neon **pooled** connection string                                                                           |
| `JWT_SECRET`, `TOTP_ENC_KEY`                                                                               | 32+ characters; 32 random bytes in base64. Losing `TOTP_ENC_KEY` makes stored two-factor secrets unreadable |
| `RESEND_API_KEY`, `MAIL_FROM`                                                                              | Resend key; sender on a domain verified in Resend, e.g. `Travel Journal <noreply@your-domain>`              |
| `STORAGE_DRIVER`                                                                                           | `s3`                                                                                                        |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | Neon Object Storage credentials (`S3_FORCE_PATH_STYLE=true`)                                                |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`                                                                     | Optional; enables summaries and "Write with AI". Model defaults to `claude-haiku-5-5`                       |

`DIRECT_URL` is only needed where migrations run, not on the API service.

## Setting up the web app on Vercel

1. **Add New → Project**, import the repository, and choose the `frontend` project (Root Directory `frontend`).
2. Add `API_INTERNAL_URL` with the API's public URL (no trailing slash) **before the first build**. Changing it later needs a redeploy.
3. Deploy, then put the resulting URL into `APP_URL` on Render.

## Free-plan behaviour

- **The API sleeps** after 15 minutes without traffic and takes up to about a minute to wake. The web app shows a short "Waking up the server" note while it waits. To keep the API awake, point a free uptime monitor (for example UptimeRobot) at `GET /health` every 5 minutes.
- **The Neon database** suspends its compute when idle on the free plan; the first query afterwards can take a few seconds. The web app tolerates this (the session refresh waits up to 20 seconds, and a "Try again" panel appears instead of signing the user out).
- **Render's filesystem is not persistent**, which is fine: images live in object storage and nothing else is written to disk.

## Checks on the live site

Register with a real address, open the verification email, sign in, reload the page (you must stay signed in), add a photo with a description of at least 80 characters (an AI summary should appear), edit it, delete it.

Two things worth confirming after any change to hosting:

- **Upload size through Vercel's rewrite.** Vercel documents a 4.5 MB request body limit for its serverless functions. Rewrites to an external origin are normally proxied without that limit, but if a 10 MB upload fails with a 413 from Vercel (not from the API), lower the client-side image limit to 4 MB (and the API limit with it), or send uploads straight to the API with CORS enabled.
- **Cookies.** The refresh cookie must be set on the Vercel domain, `Secure`, `httpOnly`, `SameSite=Lax`.
