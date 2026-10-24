# Register and verify email: walkthrough and review questions

Private study notes.

## Step by step

1. **Prisma 7 setup.** `schema.prisma` has the models and a generator, no URL. `prisma.config.ts` supplies `DIRECT_URL` for migrations. At runtime `lib/prisma.ts` builds `PrismaClient` over `PrismaPg` (the `pg` driver adapter) with the pooled `DATABASE_URL`. The generated client is not committed; test, typecheck and build run `prisma generate` first, and CI has an explicit step because lint needs the types.
2. **Schema.** `users` (complete, including 2FA columns) and `email_verification_tokens`. UUID keys, `timestamptz`, unique `email` and `token_hash`, cascade delete, index on `user_id`.
3. **Config grows.** `DATABASE_URL` (required), SMTP settings, `MAIL_FROM`. Production refuses to start on the local mail defaults.
4. **crypto.** `hashPassword` / `verifyPassword` (argon2id, OWASP minimum profile), `generateToken` (32 random bytes, base64url), `hashToken` (SHA-256).
5. **Mailer.** `Mailer` interface, `NodemailerMailer` adapter (tested at the transport boundary), `createSmtpMailer` factory. `FakeMailer` in tests records messages, so a test can extract the token from the link like a user would.
6. **Test harness.** Global setup runs `prisma migrate deploy` on the test DB (default: the compose database). `resetDatabase` clears tables with Prisma `deleteMany`, children first.
7. **POST /auth/register.** Validate, hash, create the user and token in one nested write (atomic), map unique violation to 409, then send the email best-effort.
8. **POST /auth/verify-email.** One conditional `updateMany` claims the token; if zero rows matched the token is invalid. Then mark the user verified, all in one transaction.
9. **POST /auth/resend-verification.** Uniform 200. For an unverified user: delete unused tokens, create a new one, send in the background.
10. **Rate limits** injected through `AppDeps` so tests can use generous limits, and one suite pins tight ones.

## Likely review questions

**1. Why detect duplicates with the unique index instead of checking first?**
A check-then-insert has a race: two concurrent requests both see "free" and one then fails with a raw database error, or, without a constraint, both succeed. The constraint is the only authority; we catch its error (P2002) and map it to 409.

**2. Registration returns 409 for an existing email. Isn't that user enumeration?**
Yes, and it is a documented trade-off (ADR-0008): the spec lists 409 and it is far better UX. Mitigations: a strict per-IP rate limit on register, and login returning an identical error for unknown email and wrong password. Resend, which has no UX need to disclose, answers identically either way.

**3. Why hash the password before touching the database, even for a duplicate?**
So a duplicate request costs the same time as a fresh one; otherwise the response time would also disclose whether the email exists. It also puts the expensive work outside any database transaction.

**4. Why argon2id, and why those parameters?**
It is memory-hard (resists GPU cracking) and the "id" variant resists side-channel attacks as well. 19 MiB / 2 passes / 1 lane is OWASP's minimum recommended profile, chosen to be safe on small containers; it can be raised without a migration because the parameters are stored in each hash.

**5. Why is the verification token hashed with SHA-256 and not argon2?**
Argon2 slows down guessing of low-entropy secrets. The token is 256 random bits, so guessing is infeasible regardless of hash speed, and a deterministic hash lets us look the token up by its hash.

**6. Why store only the hash?**
A database leak (backup, SQL injection, a curious operator) would otherwise hand out working verification links. With a hash, the raw token exists only in the email.

**7. How do you guarantee a token is single-use under concurrency?**
Claiming is one `UPDATE ... WHERE token_hash = ? AND used_at IS NULL AND expires_at > now`. The database serialises concurrent updates on the row; only one sees `used_at IS NULL`, so only one gets `count = 1`. There is a test that fires two requests at once and expects exactly one 200 and one 400. I also confirmed the test fails when the `used_at IS NULL` condition is removed.

**8. Why do unknown, expired and used tokens all give the same error?**
Distinguishing them tells an attacker which tokens ever existed. The user-facing recovery is the same in every case (request a new link), so nothing is lost.

**9. What if the email provider is down during registration?**
The account is committed first, the send is attempted afterwards, and failure is logged (user id only, never the address) while the request still returns 201. Resend is the recovery path. The alternative, sending inside the transaction, would hold a database connection open over a network call and still could not guarantee delivery. The proper fix at scale is an outbox/queue, listed as an improvement.

**10. Why is the resend email not awaited?**
So the response time doesn't include SMTP latency, which would reveal whether an account exists. The send function catches its own errors, so a floating promise cannot crash the process.

**11. How do you test things that involve email without sending any?**
The mailer is an interface injected into the app. Tests pass a fake that records messages; the test then reads the real link from the message and calls the verify endpoint, so the token travels the same route a user's would.

**12. Why `TRUST_PROXY` as a number, and how is it tested?**
Behind N proxies the client IP is the Nth entry from the right of `X-Forwarded-For`. A boolean would trust a header any client can set. Two tests: with 0, spoofed headers are ignored (second request is limited); with 1, different forwarded IPs get separate buckets.

**13. Why does CI run `prisma generate` explicitly?**
The generated client isn't committed. Lint is type-aware and imports it; without generation, a fresh checkout fails lint with dozens of "unsafe any" errors. I reproduced this locally before adding the step.
