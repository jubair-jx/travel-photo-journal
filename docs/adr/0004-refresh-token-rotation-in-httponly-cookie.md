# Short-lived access token plus rotating refresh token in an httpOnly cookie

The access token is a 15-minute JWT returned in the response body and held only in browser memory. The refresh token is an opaque random value, stored hashed in the database, delivered in an httpOnly, Secure, SameSite cookie, and rotated on every use. Presenting an already-rotated token revokes the whole session, on the assumption it was stolen.

This keeps long-lived credentials out of JavaScript (an XSS bug cannot read the refresh token) while keeping the API stateless for normal requests. The web app proxies `/api/*` to the API through Next.js rewrites so the cookie stays same-origin.

Rejected: tokens in localStorage (readable by any injected script), server-side sessions checked on every request (a database hit per call), and one long-lived JWT (cannot be revoked).

Consequence: a page reload loses the in-memory access token, so the client silently calls the refresh endpoint on load and on any 401.
