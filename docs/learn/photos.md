# Photos: walkthrough and review questions

Private study notes.

## Step by step

1. **Storage interface** (`lib/storage.ts`): `upload`, `delete`, `getSignedUrl`, plus a strict key check (`photos/<uuid>/<uuid>.<jpg|png|webp>`) used by both drivers.
2. **Local driver** (`lib/storage.local.ts`): writes under a directory; URLs carry `expires` and an HMAC of `key + expires`; a router verifies in constant time and streams the file. Used in development and tests.
3. **R2 driver** (`lib/storage.r2.ts`): S3 SDK against the R2 endpoint; presigned GET computed locally.
4. **Factory** (`lib/storage.factory.ts`): config to driver; derives the local signing key from the JWT secret with a label.
5. **Summarizer** (`lib/summarizer.ts`): OpenRouter client with a model list and one shared `AbortSignal.timeout(8000)`; a disabled implementation when no key or model is configured.
6. **Config**: `STORAGE_DRIVER`, R2 credentials (required only when selected), `OPENROUTER_*`, `SIGNED_URL_TTL_SECONDS`, `API_PUBLIC_URL`.
7. **Upload middleware** (`middleware/upload.ts`): multer in memory (5 MB, one file, fixed field name), then `file-type` on the bytes; sets `req.image` with the detected type and extension.
8. **Photo service**: create (summary and upload concurrently, one insert, cleanup if the insert fails), list (paged, newest first, id as tie-break), get, update (ownership check first, conditional summary, image swap, old file removed afterwards), remove (row then file).
9. **Routes**: all behind `requireAuth`; `PUT` and `POST` run `acceptImage` then `validate`.
10. **Tests**: HTTP-level with the fake storage and summarizer; a separate suite runs the whole lifecycle against the real local driver; the summarizer is tested against a local HTTP server that imitates OpenRouter.

## Likely review questions

**1. How do you guarantee users cannot see or change each other's photos?**
Every query that touches a photo filters on `id` and `userId` together (`findFirst`, `update`, `deleteMany`), so there is no code path that loads a photo and then compares owners. A photo that is not yours simply is not found. Tests prove it for each route (read, list, update, delete); I broke each filter on purpose and each break failed a test.

**2. Why 404 and not 403?**
403 confirms the photo exists. With 404, a foreign id, a missing id and a malformed id are indistinguishable.

**3. Why must the update check ownership before uploading the new image?**
Otherwise a non-owner could cause side effects (files written, an LLM call made) even though the update then fails. The test asserts that nothing is uploaded or summarized for a foreign photo.

**4. How are uploads validated?**
Size is capped by multer (5 MB, one file). The type is decided by `file-type` from the file's magic bytes against an allow-list; the client's `Content-Type` and filename are never used. The object key is random, so a filename cannot influence the path or collide. Tests send a text file labelled `image/png` (415), a real PNG labelled `text/plain` named `run-me.exe` (accepted as PNG) and a 5 MB+ file (413).

**5. Is checking magic bytes enough?**
It stops mislabelled files and most junk, but a file can start with valid image bytes and still carry a payload (polyglots). The images are only ever served as images with a fixed content type and `nosniff`, never executed, and never parsed server-side. Re-encoding and virus scanning are listed improvements.

**6. Why buffer the upload in memory?**
The cap is 5 MB and the bytes are needed twice (sniffing, then upload), so streaming to disk adds complexity for no gain. At scale, memory per request would matter and a streaming upload to the bucket would replace it.

**7. Why are images served through signed URLs and not a public bucket or the API?**
A public bucket would make every photo a permanent public URL. Proxying bytes through the API costs bandwidth and CPU. A signed URL is a time-limited capability: it works without the user's token (so an `<img>` tag can use it) and expires on its own. Trade-off: anyone who obtains a link can use it until it expires (15 minutes).

**8. How does the local driver sign links, and why not reuse R2's scheme?**
HMAC-SHA256 over `key` and `expires` with a key derived from the JWT secret. Verification uses `timingSafeEqual`, and the key must also match the strict `photos/...` shape before the disk is touched. It exists so development needs no cloud account while behaving like presigned URLs.

**9. What happens if summary generation fails or is slow?**
The photo is saved with `summary: null`. One 8-second deadline covers every model attempt, so a slow primary cannot multiply the delay across the fallbacks. The failure is logged with the models and reasons, never the description. A test proves the log excludes the description.

**10. Why null instead of keeping the old summary when an edit's regeneration fails?**
A summary of text that no longer exists is wrong data. Null is honest and consistent with create (ADR-0006).

**11. What stops a user injecting instructions into the summary prompt?**
The description is passed as the user message with a system prompt that treats it as text to summarize. A malicious description might still produce an odd summary of itself, but it cannot reach other users' data (the model gets nothing else), the output is capped at 300 characters, and it is only ever rendered as plain text.

**12. What if the database insert fails after the file was uploaded?**
The service deletes the uploaded object before rethrowing, so there is no orphan. If that deletion also fails, it is logged. Conversely on delete, the row goes first: a stray file is harmless, a row pointing at a missing file is a broken photo.

**13. How do you paginate and keep it stable?**
Offset pagination ordered by `createdAt desc, id desc`; the id breaks ties between photos with equal timestamps so pages don't repeat or skip. The (`user_id`, `created_at`) index covers the filter and the sort. Cursor pagination would scale better for very large journals.

**14. How do you run this without R2 or OpenRouter accounts?**
`STORAGE_DRIVER=local` (the default) and no `OPENROUTER_API_KEY`: files go to disk, summaries are switched off, everything else works. Config refuses `STORAGE_DRIVER=r2` unless all four R2 variables are present.
