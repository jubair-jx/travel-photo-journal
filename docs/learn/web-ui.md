# Web UI: walkthrough and review questions

Private study notes.

## Step by step

1. **Proxy** (`next.config.ts`): `rewrites` forwards `/api/*` to `API_INTERNAL_URL` (default `http://localhost:4000`). The browser only talks to its own origin, so the refresh cookie is same-origin and there is no CORS.
2. **State** (`store/`): `slices.ts` (auth in memory; ui persisted), `api.ts` (RTK Query endpoints, base query, error normalization), `session.ts` (single-flight refresh), `store.ts` (`makeStore`, persistence rules), `StoreProvider.tsx` (provider, persist gate, session restore on load, toaster, reduced-motion).
3. **Validation** (`lib/schemas.ts`): zod rules that mirror the API's, used by react-hook-form via `zodResolver`. `lib/errors.ts` maps API field errors back onto form fields.
4. **Shell**: `GuestOnly` (login and register redirect signed-in users), `AppShell` (header, nav, sign out; spinner until the session state is known, redirect when anonymous), `HomeRedirect`.
5. **Auth pages**: register (confirmation password, duplicate email shown on the field, "check your inbox" state with resend), login (remembered email, unverified state with resend, 2FA code step when the API answers `TOTP_REQUIRED`), verify-email (reads `?token=`, one guarded request, resend on failure).
6. **Journal** (`/photos`): paged grid with skeleton loading, empty state, error state with retry; add and edit in a dialog (image preview, client-side type and size checks, server errors on the right field); delete with confirmation; step back a page when the last item on a page is deleted.
7. **Security page**: set up 2FA with the QR code and manual key, confirm with a code, handle "already enabled".
8. **Motion**: fade and slide for list items and dialogs only; `MotionConfig reducedMotion="user"` honors the OS setting.

## Likely review questions

**1. Why RTK Query?**
It owns caching, request status, invalidation after mutations, and a single place (the base query) for cross-cutting behavior: auth header, envelope unwrapping, error shape, silent refresh. Components just call hooks and render states.

**2. Where is the access token kept and why?**
In the Redux store (memory) only. An XSS bug can still use it while the page is open, but it cannot be stolen for later use from storage, and it lives for 15 minutes. The long-lived credential, the refresh token, is an httpOnly cookie that scripts cannot read.

**3. You use redux-persist. Doesn't that put the token in localStorage?**
Only the `ui` slice is persisted, and only `lastEmail`. The auth slice and the API cache are outside persistence by construction (the persisted reducer wraps `ui` alone). A test dispatches a login, persists, and asserts the token, user, and cached photo text are absent from storage; I confirmed it fails if the auth slice is persisted.

**4. Walk me through silent refresh.**
A request fails with 401 and had been sent with a token. If another request already replaced the token, retry. Otherwise call the shared refresh function: concurrent callers share one in-flight `POST /auth/refresh`. On success the new token is stored and the request is retried once with it; on failure the user is signed out. Tests cover the single refresh for three simultaneous failures, no retry loop, and not refreshing for auth endpoints.

**5. Why single-flight?**
Refresh tokens are single-use and a replay is treated as theft by the server. Two overlapping refreshes with the same cookie would look like theft and end the session. One shared request avoids that within a tab.

**6. What happens on page reload?**
The in-memory token is gone. `StoreProvider` runs the same refresh call once; until it settles the auth status is "unknown" and protected pages show a spinner instead of flashing a redirect. In a browser test a hard reload made exactly one refresh request before the photos request.

**7. I saw a 401 in the console on the login page. Is something broken?**
No: with no session cookie, the first silent refresh is answered 401 and the app settles as signed out. The browser logs failed requests regardless.

**8. How do server validation errors reach the form?**
The API returns `details: [{ path, message }]`. `applyFieldIssues` puts each one on the matching field with `setError`; anything that does not match falls back to a general alert. Upload errors (413, 415) are shown under the image field.

**9. What stops a double submit of the verification link?**
The token is single use. React strict mode runs effects twice in development, which would send two requests and turn a success into "already used", so the call is guarded with a ref.

**10. How are expired image links handled?**
Signed links last 15 minutes. If an image fails to load, the list is refetched (throttled to once per 30 seconds) to get fresh links.

**11. Why plain `<img>` and not `next/image`?**
Image URLs are signed links on a configurable host (the API in development, the R2 bucket in production), and the optimizer would also proxy and cache them, defeating the short-lived links. Each use carries a lint exception with the reason.

**12. How did you test the UI?**
Unit tests for the logic that can break silently (data layer, schemas, error mapping), plus a manual run of the real UI against the real API and a real SMTP catcher: register, verify via the emailed link, unverified login, sign in, upload (including a text file disguised as a PNG, rejected by the server), edit with image swap, 2FA setup and login, reload, delete. I also forced a 401 by restarting the API with a different JWT secret and watched the browser refresh and retry.

**13. Accessibility choices?**
Labels on every field, `aria-invalid` and `aria-describedby` on errors, `role="alert"` for errors, a labelled dialog with Escape to close and focus restored, `aria-current` on navigation, reduced-motion support. Known gap: the page behind an open dialog is not marked inert.
