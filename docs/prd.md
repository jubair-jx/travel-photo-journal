# Product Requirements: Travel Photo Journal

Terms in **bold** are defined in [CONTEXT.md](CONTEXT.md). Decisions referenced as ADR-NNNN are in [adr/](adr).

## Problem Statement

Travellers collect photos from many trips but have nowhere private to keep them alongside the place, the story, and a quick reminder of what mattered. General photo apps are cluttered or public by default, and sharing a login or an upload link risks exposing personal moments to other people. A person needs a private journal where only they can see and manage their own photos, and where signing in is protected by the standard safeguards they expect from a modern service.

## Solution

A web application and REST API where a person registers, verifies their email, signs in (optionally with two-factor authentication), and keeps a personal collection of **Photos**. Each **Photo** has an **Image**, a name, a location and a description. The system adds a short **Summary** of the description automatically. A person can only ever see or change their own **Photos**; anything else behaves as if it does not exist. Images are stored privately and shown through short-lived links.

## User Stories

### Registration and email verification

1. As a visitor, I want to register with my email and a password, so that I can have a private journal.
2. As a visitor, I want my password rules explained when I submit something weak or malformed, so that I can fix it immediately.
3. As a visitor, I want my email treated case-insensitively, so that `Me@Example.com` and `me@example.com` are the same account.
4. As a visitor, I want to be told when an email is already registered, so that I know to sign in instead of waiting for an email that will not come.
5. As an **Unverified User**, I want an email with a verification link, so that I can prove I own the address.
6. As an **Unverified User**, I want the link to work only once, so that a forwarded or leaked email cannot be reused.
7. As an **Unverified User**, I want the link to expire after 24 hours, so that old emails are harmless.
8. As an **Unverified User** whose link expired or was lost, I want to request a new one, so that I am not locked out.
9. As an **Unverified User**, I want a clear message if I try to sign in before verifying, so that I know what to do next.
10. As a **Verified User**, I want to be sent straight to sign-in after verifying, so that onboarding feels finished.
11. As a visitor following a broken, expired or already-used link, I want a clear explanation and a path to request a new link, so that I am not stuck.
12. As a site owner, I want the verification secret stored only as a hash, so that a database leak does not leak working links.

### Signing in and staying signed in

13. As a **Verified User**, I want to sign in with email and password, so that I can reach my journal.
14. As a visitor, I want the same error for an unknown email and a wrong password, so that nobody can discover which emails have accounts by signing in.
15. As a **Verified User**, I want to stay signed in across page reloads, so that I am not asked to sign in repeatedly.
16. As a **Verified User**, I want my **Access Token** to be short-lived, so that a stolen one stops working quickly.
17. As a **Verified User**, I want my **Session** renewed silently in the background, so that I am not interrupted mid-task.
18. As a **Verified User**, I want to sign out, so that the **Session** ends on this device.
19. As a **Verified User**, I want a leaked or replayed **Refresh Token** to end the whole **Session**, so that an attacker cannot quietly keep access.
20. As a **Verified User**, I want the long-lived credential kept where page scripts cannot read it, so that a script-injection bug cannot steal my **Session**.
21. As a site owner, I want repeated failed sign-in, registration and resend attempts rate-limited, so that password guessing and abuse are slowed down.

### Two-factor authentication

22. As a **Verified User**, I want to start 2FA setup and get a QR code, so that I can add the account to my authenticator app.
23. As a **Verified User**, I want a manual key beside the QR code, so that I can set up when I cannot scan.
24. As a **Verified User**, I want 2FA to switch on only after I enter a correct code, so that a mistake cannot lock me out.
25. As a **Verified User** with 2FA on, I want sign-in to ask for my code when I omit it, so that the extra step is enforced.
26. As a **Verified User** with 2FA on, I want a wrong code rejected without revealing whether the password was right, so that attackers get no hints.
27. As a site owner, I want the **TOTP Secret** encrypted at rest, so that a database leak does not hand out 2FA codes.
28. As a **Verified User**, I want the authenticator entry labelled "Travel Photo Journal", so that I can recognise it among other accounts.

### Managing photos

29. As a **Verified User**, I want to add a **Photo** with an **Image**, name, location and description, so that I can record a memory.
30. As a **Verified User**, I want only JPEG, PNG and WebP up to 10 MB accepted, so that the journal stays fast and safe.
31. As a **Verified User**, I want a file that merely claims to be an image rejected, so that disguised files cannot be uploaded.
32. As a **Verified User**, I want an automatic **Summary** of my description, so that I can scan my journal quickly.
33. As a **Verified User**, I want my **Photo** to save even when summary generation is unavailable, so that a third-party outage never loses my memory.
34. As a **Verified User**, I want the **Summary** to refresh when I change the description, so that it never describes old text.
35. As a **Verified User**, I want to be unable to set or edit the **Summary** myself, so that it always reflects the description.
36. As a **Verified User**, I want to see my **Photos** newest first, so that recent trips are at the top.
37. As a **Verified User**, I want the list paginated, so that a large journal loads quickly.
38. As a **Verified User**, I want to open one **Photo** to see everything about it, so that I can read the full story.
39. As a **Verified User**, I want to edit the name, location and description of a **Photo**, so that I can correct or enrich it.
40. As a **Verified User**, I want to optionally replace the **Image** while editing, so that I can swap in a better shot.
41. As a **Verified User**, I want to delete a **Photo**, so that I control what I keep.
42. As a **Verified User**, I want deletion to also remove the stored **Image**, so that nothing lingers after I delete.
43. As a **Verified User**, I want images displayed through short-lived links, so that no permanent public address for a private image exists.

### Privacy between users

44. As a **Verified User**, I want other people to be unable to read my **Photos**, so that my journal stays private.
45. As a **Verified User**, I want other people to be unable to edit or delete my **Photos**, so that nobody can tamper with my journal.
46. As a **Verified User**, I want a request for someone else's **Photo** to look identical to a request for a missing one, so that no one can probe what exists.

### The web experience

47. As a visitor, I want pages for register, sign-in (with a code step), and email verification, so that I can complete onboarding in the browser.
48. As a **Verified User**, I want a journal page with add, edit and delete, so that I can manage photos without leaving the app.
49. As a **Verified User**, I want a 2FA setup page showing the QR code, so that I can secure my account in a few steps.
50. As a **Verified User**, I want loading, empty and error states on every page, so that I always understand what the app is doing.
51. As a **Verified User**, I want confirmation or error toasts after actions, so that I know whether something worked.
52. As a **Verified User**, I want subtle motion that does not slow me down, so that the app feels polished without being distracting.

### Operations and quality

53. As an operator, I want a health endpoint, so that hosting and monitors can tell whether the service is alive.
54. As an operator, I want misconfiguration to stop the service at startup with a clear message, so that a bad deploy never serves traffic half-configured.
55. As an operator, I want logs that never contain passwords, tokens, cookies or description text, so that logs are safe to share.
56. As an operator, I want every error returned in one consistent shape with a stable code, so that clients and tests can rely on it.
57. As a developer, I want the whole system runnable locally with one command, including a mail catcher, so that I can try everything without external accounts.
58. As a reviewer, I want automated checks (format, lint, types, tests, build, dependency audit) on every change, so that quality is enforced rather than promised.

## Implementation Decisions

### Shape

- Monorepo with two applications and a docs folder. The API is Express with TypeScript in strict mode (ADR-0001); the web app is Next.js with the App Router.
- API is built from a `createApp()` factory that receives its collaborators (mailer, storage, summarizer), so tests substitute fakes without patching modules.
- Features are vertical modules each owning routes, controller, service, input schemas and tests. Shared infrastructure sits beside them: validated configuration, errors, response helpers, logger, mailer, storage, summarizer, crypto, and middleware for authentication, validation, error handling, rate limiting and upload.
- Configuration is validated once at startup and the process exits on failure.

### Contract

- Success responses are `{ success: true, data }`; errors are `{ success: false, error: { code, message, details? } }`. Status codes used: 200, 201 on create, 400, 401, 403, 404, 409, 413, 415, 429, 500. Delete returns 200 with `data: null`.
- Endpoints have no path prefix: register, verify-email, resend-verification, login, refresh, logout, 2FA setup, 2FA verify, photos list/create/read/update/delete, and health. Details belong in the API reference.
- Every input is validated with a schema; unknown fields on photo input, including any summary, are dropped.

### Authentication

- Registration stores an **Unverified User** and a hashed **Verification Token** valid 24 hours, then emails a link to the web app. A duplicate email returns 409 (ADR-0008). Passwords are hashed with argon2id (ADR-0003).
- Sign-in rejects **Unverified Users** with 403. Unknown email and wrong password produce the same 401, and the failure path does comparable work in both cases. When 2FA is on and no code is supplied, the response is 401 with code `TOTP_REQUIRED`.
- **Access Token** is a 15-minute HS256 JWT with issuer and audience checked. **Refresh Token** is opaque, hashed at rest, rotated on use, delivered in an httpOnly Secure SameSite cookie; reuse of a rotated token revokes the **Session** (ADR-0004).
- 2FA secrets are generated server-side, encrypted at rest with an authenticated cipher and a dedicated key, and enabled only after a correct first code.

### Photos

- Schema: User, EmailVerificationToken, RefreshToken and Photo, with snake_case table names, cascading deletes from User, unique token hashes, and an index on (user, created time) for the list query.
- All photo queries are scoped by owner and return 404 for foreign or missing records (ADR-0007).
- Uploads accept JPEG, PNG and WebP up to 10 MB, verified by file signature rather than the declared type. Object keys are random and derived from user and a generated identifier; the client filename is never used.
- Images live in a private S3-compatible bucket (Neon Object Storage) behind a storage interface with a local-disk implementation for development and tests; responses carry short-lived signed links (ADR-0005).
- **Summary** generation runs server-side on create and on description change, with model fallback and an 8-second overall deadline, and degrades to no summary on failure (ADR-0006).

### Deep modules to test in isolation

- Token and cookie lifecycle (issue, rotate, detect reuse, revoke)
- Password and secret handling (hash, verify, encrypt, decrypt)
- Upload validation (size and signature checks)
- Storage interface (local and S3 implementations behind one contract)
- Summarizer (fallback order, deadline, failure handling)
- Config loader (valid and invalid environments)

### Web

- Pages for register, sign-in with a code step, verify-email (token read from the URL), photo list with add, edit and delete, and 2FA setup.
- The web server proxies `/api/*` to the API so the refresh cookie is same-origin. The access token lives in memory only; any 401 triggers one silent refresh and retry.
- Styling uses utility classes only; motion is light.

### Operations

- Docker images for the API and web app and a compose file with Postgres, API, web and a mail catcher; migrations run on release.
- CI runs install, format check, lint, typecheck, tests against a Postgres service, build and a dependency audit.
- Production: API on Render (Docker), web on Vercel, Neon for data and images, Resend for mail.

## Testing Decisions

- A good test drives the system through its public surface (HTTP for routes, the interface for infrastructure modules) and asserts observable behavior: status code, response shape, stored state, and what was sent to collaborators. It does not assert internal calls or private structure, so refactoring does not break it.
- Work follows red-green-refactor, one vertical slice at a time.
- Integration tests use Vitest and supertest against a real Postgres (compose locally, a service in CI). The mailer, storage and summarizer are replaced by fakes through their interfaces; no test touches the network.
- Every photos route has a test proving a second user cannot read, update or delete the first user's photo.
- Auth tests cover: duplicate email, unverified sign-in, identical failures, expired and reused verification tokens, rotation and reuse revocation, missing and wrong 2FA code.
- Upload tests cover: wrong type, spoofed content type, oversize, and a successful upload.
- Summary tests cover: success, fallback to the second model, total failure still saving the photo, regeneration on description change, and a client-supplied summary being ignored.
- Prior art: none yet; the first slice (infrastructure) establishes the helpers that later slices reuse.

## Out of Scope

- Password reset and email change
- Disabling 2FA and recovery codes
- Sharing **Photos** with other people or public galleries
- Albums, tags, search, maps
- Image resizing, thumbnails, malware scanning
- Device list and per-device sign-out
- Background job queue for summaries
- Social sign-in
- Admin tools and moderation

## Further Notes

- Free-tier hosting can add start-up delay; the deployment plan addresses it explicitly (see deployment doc).
- Future improvements are collected in the README: device list, scanning, asynchronous summaries, image processing, observability and end-to-end tests.
