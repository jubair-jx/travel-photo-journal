# Development

## Prerequisites

Node.js 22 (see `.nvmrc`), npm, and Docker (for Postgres and, optionally, the whole stack).

## Option A: the whole stack in Docker

```bash
cp backend/.env.example backend/.env   # then fill in JWT_SECRET and TOTP_ENC_KEY (commands are in the file)
docker compose up --build
```

- App: <http://localhost:3000> (the web app proxies `/api/*` to the API)
- API: <http://localhost:4000> (for example `/health`)
- Mailpit, which catches every outgoing email: <http://localhost:8025>

Compose starts Postgres, runs the migrations in a one-shot `migrate` service, and only then starts the API and the web app. Uploaded images live in the `uploads` volume. `docker compose down` stops everything; add `-v` to also delete the database and uploads.

Without `OPENROUTER_API_KEY` summaries are switched off and photos simply have no summary.

## Option B: run the backend and frontend on your machine

```bash
docker compose up -d postgres mailpit
(cd backend && npm ci) && (cd frontend && npm ci)
cp backend/.env.example backend/.env      # fill in the values; see the table below
(cd backend && npm run dev)  # http://localhost:4000
(cd frontend && npm run dev) # http://localhost:3000
```

For image links to work in the browser, set `API_PUBLIC_URL=http://localhost:3000/api` in `backend/.env` so they go through the web app's proxy.

Create migrations with `DIRECT_URL=postgresql://tpj:tpj@localhost:5432/tpj_dev npx prisma migrate dev --name <change>` from `backend`.

## Tests

```bash
docker compose up -d postgres     # integration tests use the tpj_test database
npm test                          # API (needs Postgres) and web
npm run lint && npm run typecheck && npm run format:check
```

The tests need no `.env` and no external accounts: the mailer, storage and summarizer are faked, and the database defaults to the compose Postgres (`DATABASE_URL_TEST` overrides it).

## Environment variables (API)

Empty values count as unset. Only the first four are required.

| Variable                                                                                                   | Default                                | Purpose                                                                           |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| `APP_URL`                                                                                                  | required                               | Public URL of the web app: CORS origin and the base of email links                |
| `DATABASE_URL`                                                                                             | required                               | Postgres connection used by the app (pooled in production)                        |
| `JWT_SECRET`                                                                                               | required                               | At least 32 characters; signs access tokens                                       |
| `TOTP_ENC_KEY`                                                                                             | required                               | 32 random bytes, base64; encrypts 2FA secrets                                     |
| `DIRECT_URL`                                                                                               | none                                   | Direct (non-pooled) connection, used only by `prisma migrate`                     |
| `NODE_ENV`                                                                                                 | `development`                          | `production` makes the refresh cookie Secure and requires `SMTP_HOST`/`MAIL_FROM` |
| `PORT`                                                                                                     | `4000`                                 |                                                                                   |
| `LOG_LEVEL`                                                                                                | `info`                                 | `fatal` to `trace`, or `silent`                                                   |
| `TRUST_PROXY`                                                                                              | `0`                                    | Number of reverse proxies in front of the API (1 behind the web proxy or Railway) |
| `JWT_ISSUER`, `JWT_AUDIENCE`                                                                               | `travel-photo-journal`, `...-web`      | Checked when verifying tokens                                                     |
| `REFRESH_COOKIE_PATH`                                                                                      | `/`                                    | Path attribute of the refresh cookie; `/api/auth` tightens it behind the proxy    |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`                                            | `localhost`, `1025`, none, none, local | Outgoing mail. Mailpit locally, Brevo in production                               |
| `STORAGE_DRIVER`                                                                                           | `local`                                | `local` (disk) or `s3` (any S3-compatible bucket)                                 |
| `LOCAL_STORAGE_DIR`                                                                                        | `./uploads`                            | Where the local driver writes                                                     |
| `API_PUBLIC_URL`                                                                                           | `http://localhost:<PORT>`              | Base of image links from the local driver                                         |
| `SIGNED_URL_TTL_SECONDS`                                                                                   | `900`                                  | Lifetime of image links                                                           |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE` | none                                   | Required when `STORAGE_DRIVER=s3`                                                 |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODELS`                                     | none                                   | Summary generation; without a key and model, summaries are off                    |
| `OPENROUTER_BASE_URL`                                                                                      | `https://openrouter.ai/api/v1`         |                                                                                   |

Web: `API_INTERNAL_URL` (default `http://localhost:4000`) is where the Next.js server forwards `/api/*`. It is read when the web app is **built**.

## Troubleshooting

- **Tests crash with `TypeError: code.charCodeAt is not a function`.** This is a Vitest error-printing bug that hides the real cause, almost always the test database being unreachable. Run `docker compose up -d postgres` and retry.
- **`docker compose up` says a variable is missing.** Create `backend/.env` from `backend/.env.example` and fill in the two secrets; compose reads it.
- **The migrate service fails.** `docker compose logs migrate` shows why; typically Postgres was not ready or the volume holds a database from an older schema (`docker compose down -v` resets it).
- **Typecheck or lint reports errors about `generated/prisma`.** Run `cd backend && npm run prisma:generate`; the Prisma client is generated, not committed.
- **Images do not load in the browser (local driver).** `API_PUBLIC_URL` must be an address the browser can reach: `http://localhost:3000/api` when going through the web app.
- **A browser console shows a 401 on public pages.** Expected: the first silent refresh finds no session cookie yet.
