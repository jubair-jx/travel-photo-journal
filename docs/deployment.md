# Deployment

_Full checklist is written in the deployment phase. Decisions so far:_

| Concern  | Choice                         | Notes                                                                                                                                                             |
| -------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API      | Railway (Docker)               | Services do not sleep by default. Verify current trial and plan terms before relying on them; a paid plan may be needed if the review falls after the trial ends. |
| Web      | Vercel                         | `/api/*` is rewritten to the API so the refresh cookie stays same-origin.                                                                                         |
| Database | Neon Postgres                  | Pooled `DATABASE_URL` for the app, direct `DIRECT_URL` for migrations.                                                                                            |
| Images   | Cloudflare R2 (private bucket) | Accessed through the storage interface; signed URLs only.                                                                                                         |
| Email    | Brevo SMTP                     | Mailpit locally.                                                                                                                                                  |
| Tests    | Postgres in compose and in CI  | `DATABASE_URL_TEST`; Neon is not used for tests.                                                                                                                  |
