# Frontend architecture

Next.js (App Router) with Tailwind utility classes only. Every page is a thin server component that renders client components, because all data comes from the authenticated API.

- **Proxy:** `rewrites` forward `/api/*` to the API (`API_INTERNAL_URL`), so the browser sees one origin and the refresh cookie is same-origin.
- **Data layer:** Redux Toolkit with RTK Query. One base query attaches the in-memory access token, unwraps the response envelope, normalizes errors, and performs a single-flight silent refresh on 401 (ADR-0011). The session is restored after a page load with the same refresh call.
- **Persistence:** redux-persist stores only the "remember my email" preference. The auth slice and API cache are never persisted.
- **Structure:** `app/` holds routes in two groups, `(auth)` for signed-out pages and `(app)` for signed-in pages behind a shell that waits for the session state; `components/` holds UI primitives and feature components; `store/` the data layer; `lib/` schemas, error helpers and types.
- **Location suggestions:** the location field offers place suggestions as you type, fetched by the browser from the public Photon geocoder (OpenStreetMap data), restricted to geographic places, debounced and cancelled when superseded. The service is free and keyless but has no published rate limit or SLA, only a fair-use request, so it can throttle (429) or be down. Therefore the field never depends on it: the last option is always "Use <text> as typed", any text is accepted, and when a lookup fails the dropdown says so and manual entry carries on. Only the typed text is sent to that service. For heavy traffic, self-host Photon or add a server-side cache.
- **AI description:** the add-photo form can draft the description from the chosen picture. The browser first shrinks a copy to 1024 px JPEG (cheaper and faster), sends it to `POST /photos/describe`, and puts the result in the description box for the user to edit; saved summaries are labelled "AI summary" on the card and in the viewer.
- **Photo viewer:** clicking a photo card opens it full size with its details, summary and edit/delete actions.
- **Forms:** react-hook-form with zod schemas mirroring the API's rules; the API's field errors are mapped back onto the matching fields.
- **States:** every page has loading, empty and error states; toasts report action outcomes; motion is limited to list items and dialogs and respects reduced-motion.
- **Local development:** with `STORAGE_DRIVER=local`, set the API's `API_PUBLIC_URL` to `http://localhost:3000/api` so image links go through the proxy.
