# Login, access token, refresh rotation, logout: walkthrough and review questions

Private study notes.

## Step by step

1. **`lib/jwt.ts`**: `createAccessTokenService(settings)` returns `sign(userId)` and `verify(token)`. HS256, 15 minute expiry, issuer and audience set on signing and checked on verifying, with `algorithms: ["HS256"]` pinned.
2. **`middleware/auth.ts`**: `requireAuth(tokens)` reads `Authorization: Bearer`, verifies, sets `req.auth.userId`. Every failure is the same `401 UNAUTHENTICATED`.
3. **Config**: `JWT_SECRET` (at least 32 chars), `JWT_ISSUER`, `JWT_AUDIENCE`, `REFRESH_COOKIE_PATH`.
4. **Schema**: `refresh_tokens` with `token_hash` unique, `revoked_at`, and a self-reference `replaced_by_id`.
5. **`session.service.ts`**
   - `login`: look up the user, always verify a password (the real hash, or a dummy one for unknown emails), then check "verified" only after the password matched. Creates a refresh token row (hash only) and signs an access token.
   - `refresh`: in one transaction, a conditional UPDATE claims the token (`revoked_at IS NULL AND expires_at > now`), the successor is created, and `replaced_by_id` links them. If nothing was claimed, and the token had been revoked, walk `replaced_by_id` forward and revoke all descendants, then answer 401.
   - `logout`: revoke the presented token; never an error.
6. **`session.controller.ts`**: sets the cookie (httpOnly, `Secure` in production, `SameSite=Lax`, configured path, 7 days), puts the access token in the body, never the refresh token. Failed refresh clears the cookie.
7. **Rate limits**: login 10 per 15 minutes, refresh and logout 120 per 15 minutes, per client IP.

## Likely review questions

**1. Why a short-lived access token plus a refresh token, rather than one token?**
A stateless token cannot be revoked, so it must be short-lived. The refresh token provides long sessions and, because it is stored server-side (hashed), it can be revoked and rotated. A compromised access token is useful for at most 15 minutes.

**2. Why is the access token kept out of cookies and the refresh token out of JavaScript?**
They protect against different attacks. The refresh token is the dangerous long-lived credential, so it sits in an httpOnly cookie that scripts cannot read (XSS). The access token travels in a header, so CSRF cannot forge a request with it; it lives in memory, so it disappears on reload and is recovered via the refresh cookie.

**3. What does pinning the JWT algorithm prevent?**
Libraries that trust the token's own `alg` header have been fooled by `alg: none` (no signature) and by HS/RS confusion. `jwtVerify(..., { algorithms: ["HS256"] })` rejects everything else. A test signs a token with HS512 using the right secret and one with `alg: none`; I confirmed the HS512 test fails when the pin is removed.

**4. Why check issuer and audience if only I sign tokens?**
Defence in depth for the day another service shares the secret or tokens are issued for another audience; it also makes a token from the staging environment useless in production if their issuer or audience differ.

**5. Walk me through refresh token rotation.**
Each refresh token is single use. Presenting it atomically marks it revoked, issues a new token, and records the link. The client always holds exactly one valid token per session.

**6. What is reuse detection and how does it work here?**
A revoked token being presented again means two parties hold it, and one of them may be an attacker. We cannot tell which, so we end the session: follow `replaced_by_id` from the replayed token to the end of the chain and revoke every descendant. Both parties are logged out and the attacker's copy is dead. The legitimate user signs in again.

**7. Why is the revocation done outside the transaction?**
The rotation transaction ends by deciding "nothing to rotate"; we then perform the revocation and throw the 401 afterwards. If the revocation ran in a transaction that subsequently threw, it would roll back and silently do nothing. The reuse tests would fail in that case.

**8. How do you stop two simultaneous refreshes both winning?**
The claim is a conditional `UPDATE ... WHERE revoked_at IS NULL`. The database row lock serialises the two; the second sees the row already revoked and matches nothing. A test fires two refreshes at once and expects one 200 and one 401. The flip side (ADR-0009): the loser looks like reuse, so the session ends. The client serialises refreshes within a tab to avoid it.

**9. Why no grace window for concurrent refreshes?**
It would make the multi-tab case smoother but gives a thief a window in which a stolen token still works. For this scope strictness is simpler to reason about; a grace window is a documented improvement.

**10. Login must not reveal whether an email is registered. How is that achieved?**
Same status and body for unknown email and wrong password; and the same work: for an unknown email we still run an argon2 verification against a dummy hash, so response time does not give it away. A test measures median latency of both paths and fails if the unknown-email path is much faster; I confirmed it fails when the dummy hash is removed.

**11. Why does 403 EMAIL_NOT_VERIFIED only appear after the password is right?**
Otherwise anyone could type an email and a random password and learn from 403 versus 401 that the account exists and is unverified. A test covers both orders, and I confirmed it fails when the checks are swapped.

**12. Why SameSite=Lax and not Strict?**
Strict would drop the cookie when a user follows a link from an email or chat, so they would look logged out on arrival. Lax still withholds the cookie on cross-site POST requests, which is how refresh and logout could be forged, so CSRF is covered.

**13. Is a refresh endpoint that only needs a cookie vulnerable to CSRF?**
A forged cross-site POST would not carry the Lax cookie; and even if it did, the response (a new access token) is unreadable to the attacker because CORS allows only our origin. Rotating a token without the user noticing is the worst case, and it would be self-healing.

**14. Why is the cookie path configurable?**
Browsers match the path against the URL they see. Behind the Next.js proxy that is `/api/auth/...`, not `/auth/...`. With the default `/` it works in both setups; production can tighten it to `/api/auth`.

**15. What happens to old tokens?**
Rows are kept (revoked or expired) as a record; a cleanup job is a listed improvement. They are indexed by user and by hash, so they do not slow lookups.
