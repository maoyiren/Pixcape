# CDPC Asset, Outfit and Workspace API

Status: implemented in PR #39; latest-head CI and end-to-end acceptance are still required.

## Authentication and ownership

All routes require an active authenticated session. The actor ID is taken from the verified NextAuth session and rechecked against the user table. Request bodies cannot choose an owner ID.

Private assets are visible only to their owner. Public assets may be reused in outfits by authenticated users. Outfit records and outfit mutations are owner-scoped; administrators do not implicitly become owners of another user's private outfit. Favorite state is scoped to the current user.

## Asset routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/assets` | List owned and public assets; optional `category`, `cursor`, `limit`, `ids` filters |
| POST | `/api/assets` | Multipart PNG upload |
| GET | `/api/assets/:assetId/file` | Read image bytes after access check |
| DELETE | `/api/assets/:assetId` | Delete an owned asset and its stored file |
| PUT | `/api/assets/:assetId/favorite` | Idempotently favorite an accessible asset |
| DELETE | `/api/assets/:assetId/favorite` | Idempotently remove the current user's favorite |

Asset list response: `{ items, nextCursor }`. Each item includes metadata, `isFavorite`, and a same-origin `fileUrl`. The server clamps `limit` to 1–60; clients must follow `nextCursor` to load more results. Supplying `ids` performs a bounded ID lookup and does not use cursor pagination.

Upload fields:
- `file`: PNG file, max 8 MiB.
- `category`: SKIN, SHAWL, COAT, CAPE, HAT, PANTS, SHOES or OTHER_ACCESSORY.
- `visibility`: PRIVATE by default; PUBLIC requires CREATOR or ADMIN role.
- `attribution`: optional attribution, max 500 characters.

The multipart request is bounded to 9 MiB including form overhead. The upload endpoint always records source=UPLOAD. AI/editor/import services must call the trusted server-side service with their own source value; clients cannot spoof provenance.

All images are signature-checked PNGs with dimensions bounded to 1024x1024. SKIN must be exactly 64x64. File bytes are stored outside the database under `/data/assets` (override with `ASSET_STORAGE_DIR`); database records contain metadata and an opaque storage key. The Docker deployment's `pixcape-data:/data` volume persists these files.

## Outfit routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/outfits` | List the current user's saved outfits |
| POST | `/api/outfits` | Create an outfit |
| GET | `/api/outfits/:outfitId` | Read one owned outfit |
| PUT | `/api/outfits/:outfitId` | Replace outfit metadata and ordered item snapshot |
| DELETE | `/api/outfits/:outfitId` | Delete an owned outfit |

Outfit payload includes name, base skin asset ID, CLASSIC/SLIM model, background, pose and up to 64 ordered wearable asset references with equipped state. List/read responses include the base skin metadata and ordered OutfitItem records with referenced asset metadata.

Validation rules:
1. A base skin must reference a SKIN / SKIN_TEXTURE asset.
2. Wearable items cannot use SKIN category.
3. Each wearable's declared category must match the referenced asset category.
4. Only owned or PUBLIC assets may be used.
5. Duplicate asset references are rejected.
6. Outfit replacement is transactional: item replacement and metadata update either both commit or both roll back.

## Workspace pointer routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/workspace` | Read the current user's project/tool/asset/outfit pointers |
| PUT | `/api/workspace` | Validate referenced resources and upsert the current user's pointers |

The pointer payload is `projectId, activeTool, activeAssetId, activeOutfitId`. Supported tools are WARDROBE, PIXEL_EDITOR and AI_GENERATOR. A project must belong to the actor; an asset must be owned or PUBLIC; an outfit must belong to the actor.

WorkspaceState currently stores pointers only. It does not store editor layer documents, canvas JSON, Character selection or generation task state.

## Error behavior

- 401: no authenticated session.
- 403: authenticated account is inactive or visibility operation is not allowed.
- 404: resource does not exist or the actor does not own it.
- 400: invalid input or asset relationship.
- 413: oversized multipart request.

Responses carrying private user data use `Cache-Control: private, no-store`. File reads require a signed-in active user even when the asset is PUBLIC.

## Known limitations

- PNG upload only; JPEG, WebP, ZIP and project bundles are not accepted.
- Asset metadata editing and object-storage adapters are not part of this API slice.
- The current schema does not yet include Character, SkinVersion, EditorDocument, GenerationTask or a full asset lineage/version relation.
- The new `/wardrobe` page is a collection-first library; `/dress-up` is a dedicated 3D studio; `/workbench/dress` still mounts the older wardrobe workspace. These routes have not yet achieved full behavior parity.
- The old 3D workspace composites non-cape clothing PNGs as full 64x64 overlays. This is not a complete per-category UV/geometry implementation and must not be treated as final garment rendering.
- Pixel editor layer documents currently recover from browser LocalStorage; cloud persistence of the full layer/canvas JSON and restore of a selected wardrobe asset into editable layers remain follow-up work.
- AI generation, editor saves and community publication still require end-to-end proof that they create and reuse the same owner-scoped Asset/Project relationships.
- Do not run production migrations or deploy until latest CI, cross-user HTTP E2E, browser workflows, backup/restore and Docker multi-database checks pass.
