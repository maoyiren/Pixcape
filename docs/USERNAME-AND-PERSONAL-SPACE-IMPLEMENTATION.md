# Username and personal-space implementation

## Identity model

- `User.username` is a nullable unique database field during compatibility rollout; the provider-specific migrations backfill every existing account to a deterministic `user-` slug before the new routes are used.
- `UserSlugHistory` is a unique slug registry. It stores both the current reserved slug and every previous slug so a username cannot be claimed by another account or reused after a rename.
- All ownership and authorization continue to use immutable `User.id`; usernames are public routing identifiers only.
- Usernames are normalized to lowercase, 3–24 characters, and limited to ASCII letters, digits, underscores, and hyphens. Reserved route/system names cannot be claimed.

## Provider migrations

The Prisma provider config selects one migration directory:
- PostgreSQL: `prisma/migrations`
- MySQL: `prisma/migrations-mysql`
- SQLite: `prisma/migrations-sqlite`

Migration `20261106000000_add_usernames_and_slug_history` adds the unique username column, creates the slug registry, backfills existing users with deterministic slugs, and reserves those initial slugs in the registry. Docker startup uses `prisma migrate deploy`; do not replace this with an untracked `db push` in production.

## API and session behavior

- `GET /api/users/me/username`: read the signed-in user's current username.
- `PUT /api/users/me/username`: validate, reserve, and update the current user's slug in a transaction.
- New OAuth, email, and emergency-admin sign-ins reserve a deterministic username before a session is issued.
- NextAuth reloads the username from the database and exposes it on `session.user.username`.
- The account menu and primary wardrobe link use the canonical `/u/[username]` routes.

## Personal-space routes

- `/u/[username]`: public profile, public assets, and published creations.
- `/u/[username]/wardrobe`: signed-in owner's existing wardrobe library.
- `/u/[username]/creations`: owner's outfits, editor documents, publication records, and share controls.
- `/u/[username]/assets`: owner's assets and public-share controls.
- `/u/[username]/favorites`: private favorites for the owner only.
- `/u/[username]/settings`: private username settings.

The legacy `/wardrobe` path redirects to the signed-in user's personal wardrobe. Historical username paths resolve through `UserSlugHistory` and redirect to the current username while preserving the requested subpage.

## Public sharing and access control

- `POST /api/publications` only publishes assets/outfits owned by the signed-in user.
- Publishing an asset or outfit creates an explicit publication record without changing the component assets' global visibility.
- A PRIVATE component is readable by visitors only while it is referenced by an active PUBLISHED outfit; an asset's own share page is readable while its own publication is active. Unpublishing removes that publication-based access unless another active publication still references the asset.
- `DELETE /api/publications/[publicationId]` unpublishes only a publication owned by the signed-in user.
- Public and unlisted asset files can be read without a session. PRIVATE assets require their owner unless an active asset/outfit publication explicitly shares them; unpublishing revokes that publication-based access.
- A non-owner can view an outfit only when it has a PUBLISHED publication record.
- Private pages and data queries use session user ID, never a URL username, as the authorization principal.

## Required verification

- [ ] Validate all three Prisma schemas and apply migrations against PostgreSQL, MySQL, and SQLite.
- [ ] Confirm existing accounts receive unique deterministic usernames.
- [ ] Confirm newly registered OAuth, email, and emergency-admin accounts receive a username before their first authenticated page render.
- [ ] Confirm username rename reserves both old and new slugs and old URLs redirect.
- [ ] Confirm two accounts cannot claim the same current or historical slug concurrently.
- [ ] Confirm user A cannot view user B's wardrobe, assets, favorites, creations, or settings.
- [ ] Confirm public asset and published outfit links work while signed out.
- [ ] Confirm PRIVATE assets remain inaccessible to signed-out visitors and other users unless referenced by an active published asset/outfit.
- [ ] Confirm unpublishing an asset/outfit revokes its public access unless another active publication still references the asset.
- [ ] Run Next.js build, unit/integration tests, browser regression, and Docker startup migration smoke test.

No build, database migration, browser, API integration, or Docker test is claimed as passed by this change.
