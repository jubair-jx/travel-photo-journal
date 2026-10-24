# TOTP secrets: AES-256-GCM bound to the user, in a versioned format

A TOTP secret has to be recoverable (the server recomputes codes from it), so unlike a password it cannot be hashed. It is encrypted with AES-256-GCM using a key from `TOTP_ENC_KEY` (32 random bytes, base64) and stored as `v1.<iv>.<tag>.<ciphertext>`. GCM authenticates as well as encrypts, so tampering makes decryption fail instead of returning garbage. The user id is supplied as additional authenticated data, so a ciphertext copied into another user's row will not decrypt.

The `v1` prefix exists so a later key rotation can introduce `v2` and re-encrypt lazily. Rotation itself is not implemented.

Login treats a wrong 2FA code exactly like a wrong password (`INVALID_CREDENTIALS`), and only asks for a code (`TOTP_REQUIRED`) after the password is proven. Setup is refused while 2FA is on, so an attacker holding only a stolen access token cannot replace the user's authenticator.

Consequences and limits:

- The encryption key is a deployment secret; losing it locks 2FA users out, and leaking it together with the database exposes their secrets.
- No replay protection: a code can be reused within its 30-second window (and its drift tolerance). Closing that needs a stored "last used step" per user.
- No recovery codes and no way to turn 2FA off; both are out of scope.
