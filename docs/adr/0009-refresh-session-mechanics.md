# Refresh sessions: chain walk, sliding expiry, a short retry window

A **Session** is the chain of refresh tokens linked by `replacedById`; there is no separate session or family column. When an already-rotated token is presented again, the service follows `replacedById` forward and revokes every descendant, including the live one. The revocation is committed before the 401 is returned (inside a transaction that then throws, it would be rolled back).

Each rotation issues a fresh 7-day token, so a session that keeps refreshing never expires on its own (sliding expiry).

**Retry window (10 seconds).** The response that carries the new cookie can be lost after the server has rotated: a reload or closed tab cancels it, or the network drops (on a slow database the in-flight time is several seconds). Without a window the client's next refresh would present a spent token and be treated as theft, ending a healthy session. So a spent token presented again within 10 seconds of its rotation, while the token it was swapped for has never been used, is treated as a retry: the unused successor is retired and a fresh token is issued. Once the successor has been used, after the window, or after a logout, a replay is theft as before. The same rule lets two tabs that refresh at the same instant both succeed.

Why: the chain walk needs no schema beyond the requested columns, and reuse is rare enough that a handful of sequential queries is fine. The cost of the window is that a thief who replays a just-rotated token within 10 seconds, before the real client uses its new one, gets a session; the real client's next refresh then fails and revokes everything, so it is detected, not silent.

Consequences:

- The web client still serialises refreshes within a tab (one in-flight refresh at a time).
- There is no absolute session lifetime; adding one needs a reference to the session's first token (a family column).
- Expired and revoked rows accumulate; a periodic cleanup job is a listed improvement.
