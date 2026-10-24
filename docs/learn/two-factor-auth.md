# Two-factor authentication: walkthrough and review questions

Private study notes.

## Step by step

1. **`encryptSecret` / `decryptSecret`** (`lib/crypto.ts`): AES-256-GCM with a random 12-byte IV per value. Output is `v1.<iv>.<tag>.<ciphertext>` (base64url). The user id is passed as AAD.
2. **Config**: `TOTP_ENC_KEY`, base64 that must decode to exactly 32 bytes; invalid values are rejected without being echoed.
3. **`lib/totp.ts`**: thin wrapper over otplib and qrcode: new base32 secret, `otpauth://` URI with issuer "Travel Photo Journal" and the email as label, QR as a PNG data URL, and `verifyTotp` with 30 seconds of drift tolerance.
4. **`two-factor.service.ts`**
   - `setup`: refuse if already enabled; generate a secret; store it encrypted with a conditional UPDATE (`twoFactorEnabled = false`); return QR and manual key.
   - `confirm`: refuse if already enabled; require a pending secret; decrypt; verify the code; enable with a conditional UPDATE.
5. **Routes**: `/2fa/setup` and `/2fa/verify`, both behind `requireAuth` and a limiter (10 per 15 minutes).
6. **Login**: `totpCode` is an optional six-digit field. After password and verified-email checks, if 2FA is on: no code gives `TOTP_REQUIRED`; a wrong code gives the same `INVALID_CREDENTIALS` as a wrong password.
7. **Tests act as the authenticator**: they take the manual key from the setup response and generate codes with the same library. A wrong code is a real code from ten minutes earlier, so it is deterministically invalid.

## Likely review questions

**1. Why encrypt the TOTP secret rather than hash it like a password?**
The server must recompute the code from the secret, so it has to be recoverable. Hashing is for values you only ever compare. Encryption at rest means a database leak alone does not expose working second factors.

**2. Why AES-GCM?**
It is authenticated encryption: confidentiality and integrity in one. A flipped bit fails decryption instead of producing a plausible wrong secret. CBC would need a separate MAC and padding handling; ECB is out of the question.

**3. What is the user id doing as AAD?**
It binds the ciphertext to its owner. Someone able to write to the database cannot copy user A's encrypted secret into user B's row (to make A's authenticator work as B's) because decryption with B's id as AAD fails. A test confirms decrypting under another id throws.

**4. Why a version prefix?**
So a future key rotation can introduce `v2`: new writes use the new key, old values still decrypt with the old one and can be migrated lazily. Rotation is not built; the format leaves room.

**5. Why is the nonce random rather than a counter?**
With a single key, a repeated (key, nonce) pair in GCM is catastrophic. A random 96-bit nonce makes a collision negligible at this scale, and a counter would need coordinated state across instances.

**6. Why does setup refuse when 2FA is already on?**
Otherwise anyone with a stolen access token (valid for 15 minutes) could call setup, replace the secret with their own, and lock the real user's authenticator out. Changing a second factor should require proving the current one; that flow (disable/re-enrol) is out of scope.

**7. Why must a pending secret not enable 2FA by itself?**
If a user scanned nothing and 2FA switched on, they would be locked out at their next login. Enabling only after a correct code proves the authenticator is configured.

**8. What does the drift tolerance do and what does it cost?**
Phone and server clocks differ; the code from the adjacent 30-second step is accepted. It widens the valid set from one to three codes per instant, which is the standard trade-off. Rate limiting and the need for the password first keep guessing impractical (about 3 in a million per attempt).

**9. Why does a wrong code return the same error as a wrong password?**
So an attacker who has a password list cannot learn whether the password was right from the code step: with a code supplied, "wrong password" and "right password, wrong code" are indistinguishable. `TOTP_REQUIRED` is only returned after the password is proven, and the spec requires it.

**10. Is there any information leak at all, then?**
Yes, one: if you send the right password without a code to an account with 2FA, you learn the password is right and 2FA is on. That is inherent in "ask for the code when missing" (required by the spec), and it only helps an attacker who already has the password.

**11. What about replay of a captured code?**
Not prevented: within its window a code can be used again. Fixing it means recording the last accepted time step per user and rejecting anything not newer. Listed as an improvement; the exposure needs an attacker who already has the password and intercepts a code within 30 to 60 seconds.

**12. What if `TOTP_ENC_KEY` is lost or rotated carelessly?**
Every 2FA user's secret becomes undecryptable and they cannot sign in. Hence the format version, and the note in the deployment checklist to treat the key like a database credential. There are no recovery codes; that is another listed improvement.

**13. How do you test TOTP without waiting for real time?**
The library accepts an explicit epoch. Tests generate the code for "now" (valid), "30 seconds ago" (previous step, valid because of drift tolerance) and "10 minutes ago" (invalid). I also broke the tolerance both ways (zero, and 15 minutes) to confirm each test fails.
