# Cloudflare R2 behind a StorageService interface

Images are stored in a private Cloudflare R2 bucket through the S3-compatible SDK. The database stores only the object key, and clients receive short-lived signed URLs. All access goes through a `StorageService` interface (upload, delete, getSignedUrl) with an R2 implementation and a local-disk implementation for development and tests, so tests need no cloud credentials and the provider can change without touching feature code.

Rejected: a public bucket (anyone with a URL sees a private photo), storing bytes in Postgres (bloats the database and its backups), and storing full URLs in the database (they expire and leak the bucket layout).

Consequence: signed URLs are generated per response. Listing a page of photos signs one URL per photo, which is local computation rather than a network call per photo.
