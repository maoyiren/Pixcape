# CDPC Unified Platform Architecture V2

Status: implementation baseline in PR #39  
Scope: additive architecture foundation; not a declaration that every product module is complete.

## Product shape

CDPC combines three product pillars:

1. Character wardrobe and outfit composition: the primary interactive experience.
2. Creation tools: pixel editing and AI generation, independently usable and interoperable.
3. Creator community: discoverable assets, published work, favorites and creator profiles.

The product is organized around reusable user assets and projects, not separate copies of the same files in each tool.

## Runtime architecture

- Next.js App Router is the sole product page/router target.
- Keep the application as a modular monolith; do not introduce microservices for the current scale.
- UI modules call domain services; domain services own validation, permissions and persistence.
- Rendering/editing engines remain isolated from page shells so route redesigns do not require engine rewrites.
- Long-running AI generation is an asynchronous task boundary and must not block normal request handlers.
- Binary content is stored in controlled file/object storage. The database stores metadata and stable storage keys, never durable base64 blobs.

## Canonical domain vocabulary

- Character: a user's avatar/model context.
- Skin: the base 64x64 Minecraft skin texture and model type (CLASSIC/SLIM).
- Asset: reusable binary-backed content with ownership, type, category, source, visibility and attribution metadata.
- Outfit: a saved composition for a character, including the base skin and ordered wearable items.
- Project: a user's working creation container.
- Publication: a community-facing publication of an asset or outfit.
- Favorite: a user's saved reference to a reusable asset.
- WorkspaceState: a durable pointer to the active project/tool/asset/outfit for cross-tool handoff.

The category values are intentionally distinct: SKIN, SHAWL, COAT, CAPE, HAT, PANTS, SHOES, OTHER_ACCESSORY. In particular, shawl, coat and cape must never be collapsed into one category: their UV mapping, render placement and export behavior differ.

## Persistence added in PR #39

| Model | Responsibility |
|---|---|
| Asset | Asset metadata, storage key, ownership, project association and visibility |
| Outfit | Saved outfit and base skin/model reference |
| OutfitItem | Ordered wearable asset references and equipped state |
| AssetFavorite | Unique user-to-asset favorite relation |
| Publication | Draft/published community representation of an asset or outfit |
| WorkspaceState | Stable cross-tool pointers, not a second copy of the asset data |

All three providers are represented:
- PostgreSQL: `prisma/schema.prisma` + `prisma/migrations/`
- MySQL: `prisma/schema.mysql.prisma` + `prisma/migrations-mysql/`
- SQLite: `prisma/schema.sqlite.prisma` + `prisma/migrations-sqlite/`

The migration is additive. Existing authentication, projects, creator profiles, audit logs and rate-limit tables are not renamed or dropped.

## Security invariants for the service layer

1. The authenticated user ID comes from the server session, never from a request body.
2. Private assets, outfits, workspace state and drafts are only readable/writable by their owner or an authorized administrator.
3. Public visibility is explicit; unlisted/private content is not discoverable through public list endpoints.
4. Every OutfitItem asset must be validated as an allowed wearable category; SKIN is only the base skin and cannot be worn as an item.
5. A project, skin, asset and outfit referenced in one operation must belong to the same user or be explicitly public/licensed for reuse.
6. Storage keys are opaque server-issued identifiers. Clients cannot choose arbitrary filesystem paths.
7. File bytes are validated by MIME/signature, size and supported dimensions before a record is committed.

## Next implementation sequence

1. Ownership-checked asset/outfit services and API routes.
2. Persistent wardrobe save/load, including skin model, equipped state, item order, pose and background.
3. Workspace handoff between wardrobe, pixel editor and AI generator using stable IDs.
4. Personal library and favorites backed by Asset/AssetFavorite.
5. Community publication and moderation workflows.
6. Extract the legacy studio's useful engine code and remove duplicate Vite page entry points only after parity tests pass.

## Rollout rules

- Never apply these migrations to production until CI passes for PostgreSQL, MySQL and SQLite.
- Back up the production database before deployment.
- Deploy the application and additive migration as one controlled release.
- Verify existing login, OAuth, project and admin workflows after migration.
- Keep rollback instructions and avoid destructive schema operations during the initial migration.
