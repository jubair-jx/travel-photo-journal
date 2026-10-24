# S3-compatible object storage behind a StorageService interface

Images are stored in a private bucket on an S3-compatible service (Neon Object Storage in production) through the AWS S3 SDK. The database stores only the object key, and clients receive short-lived signed URLs. All access goes through a `StorageService` interface (upload, delete, getSignedUrl) with an S3 implementation and a local-disk implementation for development and tests, so tests need no cloud credentials and the provider can change without touching feature code. The S3 driver is configured by endpoint, region, credentials, bucket and path-style addressing, so Neon, Cloudflare R2 and AWS S3 are all a configuration change.

Why Neon: one vendor and one dashboard for data and images, and presigned URLs are supported. Costs: Neon Object Storage is in beta, pricing is not final, buckets belong to a database branch, and it requires path-style addressing and SigV4. Because the provider is configuration, moving to R2 later means new env values and a data copy, not code.

Rejected: a public bucket (anyone with a URL sees a private photo), storing bytes in Postgres (bloats the database and its backups), and storing full URLs in the database (they expire and leak the bucket layout).

Consequence: signed URLs are generated per response. Listing a page of photos signs one URL per photo, which is local computation rather than a network call per photo.
