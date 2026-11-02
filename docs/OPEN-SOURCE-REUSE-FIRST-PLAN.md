# CDPC Open-Source Reuse-First Plan

Status: adoption policy and first-pass audit, 2026-11-02
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

1. MIT, Apache-2.0 and BSD-style dependencies are preferred, subject to preserving notices and checking all transitive dependencies and bundled assets.
2. GPL/AGPL projects are research or separately deployed integrations by default. No source code is copied into CDPC until legal obligations and distribution/network-use implications have been reviewed.
3. A repository's top-level license does not automatically cover third-party textures, fonts, models, icons, sample skins or AI model weights.
4. Never embed a complete Vite app just to reuse one editor capability. Extract framework-independent helpers, React hooks/components, or run a separately deployed tool only when necessary.
5. Do not add a dependency solely because it has more features. It must solve a demonstrated CDPC gap and pass build, security, mobile and license checks.

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

### R3 — Only then extend specialized features
- Pose and scene export (MC-Poser evaluation).
- Bedrock geometry and pack conversion (format/license evaluation).
- AI generation and image-to-skin post-processing (real output evaluation).
- Creator publication and community workflows.

## Acceptance criteria

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
