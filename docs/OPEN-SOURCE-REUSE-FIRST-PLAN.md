# CDPC Open-Source Reuse-First Plan

Status: adoption policy, source audit and integration findings, 2026-11-02
Target: PR #39 branch `architecture/cdpc-unified-platform`

## Decision

CDPC will prefer mature, permissively licensed engines and libraries over reimplementing generic editing, rendering, image-processing, and packaging capabilities. Keep Next.js App Router as the only product page/router. Reuse engines as isolated modules or libraries; do not import another project's whole Vite application or replace the current deployment architecture.

The goal is to reduce custom code while preserving CDPC's product-specific data model, ownership, security, and user experience.

## First-pass audit of the current PR

- PR #39 already depends on `skinview3d` and has a dedicated Three.js preview component.
- `app/editor/components/PixelCanvasEditor.tsx` currently implements its own 64x64 pixel buffer, layers, fill, undo/redo, import/export and local draft storage.
- The pixel editor currently saves a flattened PNG to the asset API; full cloud persistence of the editable layer document and wardrobe-to-editor restoration are not complete.
- `app/editor/editor-studio.tsx` already separates the Next.js route shell from the preset/Blockbench editor runtime.
- The PR explicitly keeps the legacy Vite app and separately bundled Blockbench runtime until capability-parity checks prove they can be safely retired. Keep that safeguard.

## Reuse decisions

### Identity, authorization and cloud persistence (reuse first; do not rewrite)

| Capability | Existing project / component | Decision |
|---|---|---|
| Login, OAuth, email/password, email link, sessions | [Auth.js / NextAuth](https://github.com/nextauthjs/next-auth) already installed as `next-auth` with `@next-auth/prisma-adapter` | Keep the existing provider/session system. Reuse its adapters and callbacks; fix and test current provider configuration rather than introducing a second identity provider or migrating accounts to Clerk/Auth0/Supabase. |
| User and identity persistence | Existing Prisma `User`, `Account`, `Session`, `VerificationToken` models | Keep existing user IDs and provider account links. Do not replace the user database or create a parallel account table. |
| Roles and permissions | Existing `UserRole` (`USER/CREATOR/ADMIN`), `UserStatus`, creator review status, owner-scoped API checks and `AuditLog`; optionally [CASL](https://github.com/stalniy/casl) (MIT) if a centralized policy engine is needed | First consolidate and test existing authorization helpers. Add CASL only if policy complexity warrants it; do not add a second RBAC database or duplicate role model. Enforce authorization on the server/API, not only by hiding UI. |
| Cloud project/workspace save | Existing Prisma `Project` and `WorkspaceState`, authenticated workspace API, owner checks | Reuse these for structured project state, active tool, asset and outfit pointers. Extend with versioned document metadata only where required. |
| Binary asset persistence | Existing `Asset` metadata + persistent `/data/assets` storage adapter and Docker volume | Keep the current filesystem adapter as a working self-hosted backend. Add an S3-compatible storage adapter using the AWS SDK for JavaScript v3 (Apache-2.0) when remote object storage is configured; support providers such as Cloudflare R2 or any S3-compatible service through environment variables. Keep storage keys opaque and files private by default. |
| Sync, ownership and recovery | Existing Prisma transactions, per-user workspace state, owner-scoped asset/outfit APIs | Reuse the existing database and API boundary. Add optimistic versioning/conflict handling and save status only where the real multi-device workflow needs it; do not introduce a separate sync SaaS or proprietary lock-in. |

Important: authentication answers *who signed in*; authorization answers *what that user may do*. Auth.js should not be treated as a complete permission system. Every read, write, delete, publication and admin action must perform server-side owner/role/status checks and be covered by cross-user tests.


| Capability | Candidate | Decision |
|---|---|---|
| Minecraft skin 2D/3D editing, UV mapping, layers, history, 3D raycast painting | [Skin Anvil](https://github.com/spencerfrost/skin-anvil) | Highest-priority code audit. Repository describes a MIT-licensed React/Three.js/skinview3d engine. Extract/adapt focused engine modules only; do not bring its Vite app or Express proxy into CDPC. |
| Minecraft 3D skin/cape preview | [skinview3d](https://github.com/bs-community/skinview3d) | Keep the existing dependency and current renderer. Avoid introducing a competing renderer unless a tested missing capability justifies it. |
| General pixel-art editor | [Piskel](https://github.com/piskelapp/piskel) | Reference or optional standalone workflow only. It is a complete sprite editor, not a Minecraft UV-aware engine; README says mobile/tablet is unsupported. Do not embed the whole app by default. |
| 3D model authoring | [Blockbench](https://github.com/JannisX11/blockbench) | Keep the existing separately bundled integration. Respect GPL-3.0-or-later and maintain its notices/source obligations. |
| Pose/scene presentation | [MC-Poser](https://github.com/PckyDev/MC-Poser) | Later audit for isolated pose/export modules and all bundled asset licenses; not a current blocker. |
| Bedrock model conversion/validation | [obj-skin-studio](https://github.com/MCMrARM/obj-skin-studio), [MBSM](https://github.com/Darktubbie/MBSM) | Evaluate format compatibility and license before reuse. MBSM is GPL-3.0; do not copy its code into the proprietary application without a deliberate licensing decision. |
| AI skin generation | [Minecraft Skin Generator](https://github.com/wjddusrb03/minecraft-skin-generator), [MC-skin-skill](https://github.com/ZhaoJun233/MC-skin-skill) | Reuse workflow ideas and compatible post-processing only after testing output quality, license, model terms and hosting cost. Do not adopt research prototypes as production services without validation. |
| Generic image processing | Sharp and small focused pixel-processing libraries | Prefer existing maintained libraries over hand-written pixel transforms. Audit each dependency and license before adding it. |

## License and integration guardrails

6. Preserve the current Auth.js/NextAuth + Prisma identity stack and user IDs. A new identity SaaS is not justified while existing users and OAuth account links already live in the database.
7. Keep cloud persistence provider-neutral: Prisma for structured records, an interchangeable filesystem/S3-compatible object storage adapter for binary assets, and per-user authorization at the API boundary. Never expose private storage keys as public URLs.
8. Prefer existing Docker persistent-volume storage for the current deployment; S3/R2 is an optional backend, not a mandatory migration or a prerequisite for the editor workflow.

1. MIT, Apache-2.0 and BSD-style dependencies are preferred, subject to preserving notices and checking all transitive dependencies and bundled assets.
2. GPL/AGPL projects are research or separately deployed integrations by default. No source code is copied into CDPC until legal obligations and distribution/network-use implications have been reviewed.
3. A repository's top-level license does not automatically cover third-party textures, fonts, models, icons, sample skins or AI model weights.
4. Never embed a complete Vite app just to reuse one editor capability. Extract framework-independent helpers, React hooks/components, or run a separately deployed tool only when necessary.
5. Do not add a dependency solely because it has more features. It must solve a demonstrated CDPC gap and pass build, security, mobile and license checks.

## Source-level audit findings (2026-11-02)

### Skin Anvil: adopt focused editing primitives, not its application

The upstream repository's root `LICENSE` is MIT (copyright Spencer Frost); retain the copyright and permission notice for any copied or adapted substantial portions. Its client is a separate React 18 + Vite 7 application and pins `three@0.156.1` with `skinview3d@^3.0.1`. CDPC is React 19 / Next.js 16 and currently declares `three@^0.186.0` and `skinview3d@^3.4.2`. Do not transplant the upstream 3D raycast implementation or assume Three.js object compatibility until the installed dependency graph is checked and both code paths use the same Three.js runtime.

| Upstream module | CDPC equivalent / gap | Decision |
|---|---|---|
| `client/src/lib/paintTools.js` | CDPC has its own flood-fill and pixel buffer, but no stroke interpolation helper | Adapt the pure `bresenhamLine`, `uvToTexel`, RGBA and bounded-fill helpers into a typed, unit-tested CDPC domain module; preserve notices |
| `client/src/constants/skinLayers.js` + `skinParts.js` | CDPC canvas currently treats the whole 64×64 image as one rectangular painting surface | Reuse the UV-region and inner/outer layer model after validating Classic/Slim UV behavior |
| `client/src/hooks/useSkinEditor.js` | CDPC has a React canvas component with local state and localStorage draft | Do not copy the hook wholesale; adapt its single document-canvas, per-layer masks, history and eyedropper behavior to the CDPC document model |
| Skin Anvil 3D raycast viewport | CDPC already uses `skinview3d`, but its Three.js dependency version differs | Defer until one shared Three.js instance is proven; then adapt raycast-to-texel mapping and stroke interpolation |
| Skin Anvil Vite/Express application | CDPC uses Next.js App Router, authenticated APIs and Docker persistence | Reject whole-app integration; do not add its proxy/server or second frontend runtime |

### CDPC findings confirmed in the PR branch

- `PixelCanvasEditor.tsx` currently stores a custom array-based 64×64 document, supports pencil/eraser/fill, layers, undo/redo and PNG import/export. It does not yet implement an eyedropper, UV-part boundaries, or Bresenham interpolation for continuous pointer strokes.
- The editor draft is stored in browser `localStorage`. “Save to wardrobe” uploads only a flattened PNG; it does not save the editable layer document or update the persisted workspace pointer to the new asset.
- `WorkspaceState` currently stores project/tool/asset/outfit pointers. It is not yet a versioned canvas-document store.
- The wardrobe's 3D preview composes non-cape garment PNGs by drawing each full 64×64 image over the base skin. This is not yet a UV-aware garment-layer compositor and needs real texture/format validation before claiming all clothing categories render correctly.
- PR #29 merged a distinct `/dress-up` 3D studio and a separate `/wardrobe` entry. PR #39 initially redirected `/dress-up` to `/wardrobe`, which discarded that already-merged route distinction. This regression has been corrected on the PR #39 branch: `/dress-up` again renders the existing `DressUpStudio`, and the navigation exposes both `衣橱` and `3D 换装`.

### Immediate reuse sequence

1. Extract/adapt Skin Anvil's pure pixel math and UV-region/layer constants into a typed CDPC domain module, with unit tests and MIT attribution.
2. Define one versioned editable-document JSON shape and persist it through the existing authenticated `WorkspaceState`/project boundary; retain localStorage only as an offline recovery cache.
3. Add wardrobe-to-editor import and restore selected skin/outfit assets into the same editable document; save both document and flattened PNG.
4. Only after dependency-tree verification, integrate UV raycasting using the exact Three.js instance owned by the active `skinview3d` runtime.

## Implementation order

### R1 — Skin Anvil engine comparison (next)
- Inspect source modules, exact license file, dependency tree, Three.js/skinview3d version alignment, tests and recent maintenance.
- Compare its pixel buffer, layer model, UV constants, flood-fill, line interpolation, undo/redo and UV raycast against the current `PixelCanvasEditor.tsx`.
- Produce a module-by-module reuse map: adopt, adapt, keep current, or reject.
- Prefer replacing duplicated low-level editing logic over rewriting the page shell.

### R2 — Integrate the reusable skin-editing engine
- Keep CDPC's Next.js routes, auth, asset API and wardrobe data model.
- Use one canonical editable document format with 64x64 texture, Classic/Slim model, base/overlay layer semantics, visibility/opacity and history.
- Connect the document to `skinview3d` so 2D UV edits and 3D painting update the same document.
- Persist the editable document through the authenticated workspace/asset APIs; do not rely on localStorage as the only save mechanism.
- Restore a selected wardrobe skin into the editor and save the resulting PNG/document back to the same user's library.

### R3 — Reuse and harden identity, permissions and cloud save
- Keep Auth.js/NextAuth providers and Prisma adapter; test real email/password and configured OAuth/email-link providers.
- Preserve existing User IDs, Account links, roles, status, sessions and admin bootstrap behavior.
- Centralize server-side authorization helpers for owner, public/unlisted visibility, creator review state and admin operations. Add CASL only if it reduces duplication rather than adding complexity.
- Complete authenticated cross-user tests for every asset, outfit, workspace and publication operation.
- Persist editable project/layer documents through the existing WorkspaceState/Project and Asset APIs; retain the current persistent Docker volume.
- Add an S3-compatible adapter behind the existing storage interface for optional R2/S3-compatible deployment; test upload, read, delete, private access and failure compensation.
- Add save versioning/conflict protection and cross-device restore tests.

### R4 — Only then extend specialized features
- Pose and scene export (MC-Poser evaluation).
- Bedrock geometry and pack conversion (format/license evaluation).
- AI generation and image-to-skin post-processing (real output evaluation).
- Creator publication and community workflows.

## Acceptance criteria

- Existing accounts, OAuth provider links and user IDs remain unchanged; no parallel login stack is introduced.
- User/creator/admin permissions are enforced server-side and tested against two separate authenticated users.
- Project/workspace metadata persists in the existing Prisma database; binary assets persist on the Docker volume or configured S3-compatible backend.
- Private assets cannot be fetched by another user by guessing IDs or storage keys.
- A user can save, sign out, sign in on another device and restore the same editable document and outfit state.

- The reused engine builds inside the existing Next.js app without a second Vite page runtime.
- No duplicate 64x64 editing/UV logic remains without a documented reason.
- 2D editing, 3D painting, base/overlay layers, Classic/Slim, undo/redo and PNG export pass browser tests.
- A real authenticated user can import a wardrobe skin, edit it, save it, refresh, sign in on another device and restore it.
- Existing outfit, asset ownership, authentication, database migrations and Docker deployment remain intact.
- All reused code, dependencies and bundled assets have recorded license provenance.

## Explicit non-goals

- Do not rewrite CDPC in another framework.
- Do not import every candidate project.
- Do not replace `skinview3d` with another renderer without a measured reason.
- Do not remove Vite/Blockbench assets until route and capability parity tests demonstrate they are unused.
- Do not call a module complete because CI passes; validate the actual end-to-end user workflow.
