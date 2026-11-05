# S3-compatible asset storage

CDPC keeps asset metadata in Prisma and binary PNG files in a storage backend.

## Backend selection

- If all S3 settings are absent, new uploads continue to use `ASSET_STORAGE_DIR` (default `/data/assets`).
- If any S3 setting is present, the endpoint, bucket, Access Key ID and Secret Access Key must all be configured. Partial configuration fails closed instead of silently writing to local disk.
- New S3 objects are recorded with a `s3/assets/<uuid>.png` storage key. Existing `assets/<uuid>.png` records remain on local disk and continue to be read/deleted there. Enabling S3 does not migrate old objects.
- S3 credentials are read from encrypted `AppSetting` values at request time. The driver uses AWS Signature Version 4 and path-style requests over HTTPS for PUT, GET and DELETE.

## Admin configuration

Open the configured admin route, then Storage. Set:

- Endpoint: HTTPS S3-compatible endpoint (for example, an S3 or R2 endpoint)
- Bucket
- Region (use the provider's required signing region; Cloudflare R2 commonly uses `auto`)
- Access Key ID
- Secret Access Key

Save both credentials. On the first configuration both are required; later, leaving a credential blank preserves its existing encrypted value. Rotate credentials by entering the replacement values. Credentials cannot be cleared independently while S3-backed assets still reference the bucket.

## Operational notes

- The asset API remains authenticated and applies the existing ownership/public-visibility checks before reading object bytes.
- PNG validation, 8 MB upload limit, SHA-256 metadata and database cleanup behavior remain in place.
- Asset deletion reads a backup before removing the object and restores it if the database delete fails.
- The storage settings page reports the selected backend for new uploads. It does not claim that a live bucket connectivity test has passed.
- Configure bucket permissions for the application credentials and lifecycle/versioning/backup policy separately. Do not make private asset objects publicly readable; the application controls access through its authenticated file route.
- A real provider upload/download/delete smoke test is still required before enabling this on production.
