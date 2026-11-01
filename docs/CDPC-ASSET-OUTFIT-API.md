# CDPC Asset and Outfit API

Status: implemented on `architecture/cdpc-unified-platform`; pending CI and review.

## Authentication and ownership

All routes require an active authenticated session. The actor ID is taken from the verified NextAuth session and rechecked against the user table. Request bodies cannot choose an owner ID.

Private assets are visible only to their owner. Public assets may be reused in outfits by authenticated users. Outfit records and outfit mutations are owner-scoped; administrators do not implicitly become owners of another user's private outfit.

## Asset routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/assets` | List owned and public assets; optional `category`, `cursor`, `limit` filters |
| POST | `/api/assets` | Multipart PNG upload |
| GET | `/api/assets/:assetId/file` | Read image bytes after access check |
| DELETE | `/api/assets/:assetId` | Delete an owned asset and its stored file |

Upload fields:
- `file`: PNG file, max 8 MiB.
- `category`: SKIN, SHAWL, COAT, CAPE, HAT, PANTS, SHOES or OTHER_ACCESSORY.
- `visibility`: PRIVATE by default; PUBLIC requires CREATOR or ADMIN role.
- `attribution`: optional attribution, max 500 characters.

The upload endpoint always records source=UPLOAD. AI/editor/import services must call the trusted server-side service with their own source value; clients cannot spoof provenance.

All images are signature-checked PNGs with dimensions bounded to 1024x1024. SKIN must be exactly 64x64. File bytes are stored outside the database under `/data/assets` (override with `ASSET_STORAGE_DIR`); database records contain metadata and an opaque storage key. The Docker deployment's `pixcape-data:/data` volume persists these files.

## Outfit routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/outfits` | List the current user's saved outfits |
| POST | `/api/outfits` | Create an outfit |
| GET | `/api/outfits/:outfitId` | Read one owned outfit |
| PUT | `/api/outfits/:outfitId` | Replace outfit metadata and ordered item snapshot |
| DELETE | `/api/outfits/:outfitId` | Delete an owned outfit |

Outfit payload includes name, base skin asset ID, CLASSIC/SLIM model, background, pose and up to 64 ordered wearable asset references with equipped state.

Validation rules:
1. A base skin must reference a SKIN / SKIN_TEXTURE asset.
2. Wearable items cannot use SKIN category.
3. Each wearable's declared category must match the referenced asset category.
4. Only owned or PUBLIC assets may be used.
5. Duplicate asset references are rejected.
6. Outfit replacement is transactional: item replacement and metadata update either both commit or both roll back.

## Error behavior

- 401: no authenticated session.
- 403: authenticated account is inactive or visibility operation is not allowed.
- 404: resource does not exist or the actor does not own it.
- 400: invalid input or asset relationship.
- 413: oversized multipart request.

Responses carrying private user data use `Cache-Control: private, no-store`.

## Current limitations / next work

- PNG upload only; JPEG, WebP, ZIP and project bundles are not accepted.
- Public file reads currently also require a signed-in user.
- Asset metadata editing, favorites, storage cleanup jobs and object-storage adapters are not part of this API slice.
- `/wardrobe` and `/workbench/dress` now use a shared native Next.js workspace that calls the asset and outfit APIs for listing, PNG upload, equip/unequip, save, load and delete. The 3D preview uses skinview3d and is driven by the selected cloud assets. This first integration still needs authenticated browser E2E validation, including cape rendering and cross-device restore.
- Do not run production migrations or deploy until CI, backup/restore and end-to-end checks pass.
