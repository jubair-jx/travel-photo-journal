# Refresh sessions: chain walk, sliding expiry, no grace window

A **Session** is the chain of refresh tokens linked by `replacedById`; there is no separate session or family column. When an already-rotated token is presented again, the service follows `replacedById` forward and revokes every descendant, including the live one. The revocation is committed before the 401 is returned (inside a transaction that then throws, it would be rolled back).

Each rotation issues a fresh 7-day token, so a session that keeps refreshing never expires on its own (sliding expiry), and there is no grace window: a second refresh with the same token, even a millisecond later, is treated as reuse and ends the session.

Why: the chain walk needs no schema beyond the requested columns, and reuse is rare enough that a handful of sequential queries is fine. A grace window would tolerate two tabs refreshing at once, but it also gives a thief a window in which a stolen token still works.

Consequences:

- The web client must serialise refreshes within a tab (one in-flight refresh at a time). Two tabs refreshing at the same instant can still sign the user out.
- There is no absolute session lifetime; adding one needs a reference to the session's first token (a family column).
- Expired and revoked rows accumulate; a periodic cleanup job is a listed improvement.
