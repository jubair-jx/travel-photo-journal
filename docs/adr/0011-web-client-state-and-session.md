# Web client: RTK Query, single-flight silent refresh, persistence only for non-sensitive state

The web app uses Redux Toolkit with RTK Query for all API access. One base query wraps `fetchBaseQuery`: it attaches the in-memory access token, unwraps the API's `{ success, data }` envelope, and normalizes failures into one `ApiError` shape (`status`, `code`, `message`, field `details`), including a `NETWORK_ERROR` when no response arrives.

When a request fails with 401 it triggers a silent refresh and retries once. The refresh token is single-use and the server treats a replay as theft (ADR-0009), so refreshes are single-flight: every concurrent caller shares one `POST /auth/refresh` and its result. A request that failed with an older token simply retries if another request has already swapped the token. Public auth endpoints (login, register and so on) are excluded, because a 401 there means wrong credentials, not an expired token. A failed refresh signs the user out. The same single-flight function restores the session after a page load, since the access token lives only in memory (ADR-0004).

redux-persist is configured, but only the `ui` slice is persisted, and only its `lastEmail` field (the "remember my email" convenience). The auth slice and the RTK Query cache are never persisted: persisting the access token would put it in `localStorage`, readable by any injected script, which is the exposure ADR-0004 exists to avoid. A test proves the token, the user and cached photo data never reach storage; breaking that (persisting the auth slice) fails it.

Consequences:

- A page reload costs one refresh request before protected pages render (they show a spinner while the session state is "unknown").
- Image links expire (15 minutes by default); when an image fails to load, the list is refetched for fresh links, at most every 30 seconds.
- Two browser tabs refreshing at the same instant can still look like token reuse to the server (ADR-0009); single-flight only protects within a tab.
- Console shows a harmless 401 on public pages, from the first silent refresh when no session cookie exists yet.
