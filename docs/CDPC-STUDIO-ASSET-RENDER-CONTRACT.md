# CDPC Studio Asset & Rendering Contract

Status: implementation contract for P0; this document does not claim that the listed rendering features are implemented.

## 1. Product behavior

CDPC Studio has two different preview modes:

- **Asset preview**: selecting a catalog item shows that item by itself in its own preview surface. It must not silently substitute a full character render.
- **Try-on preview**: selecting or removing an item immediately updates the character preview. If the user imported a skin, that skin remains the base texture.
- **Outfit preview**: a complete outfit is the composition of the base skin, all equipped garment layers, and separately rendered back equipment where applicable.

The asset card may show a thumbnail for fast scanning, but a thumbnail is not a substitute for the single-item rendered preview.

## 2. Canonical category vocabulary

The shared domain and PostgreSQL enum are the source of truth:

| Category | Domain value | Rendering status |
|---|---|---|
| Skin | `SKIN` | Base 64×64 or 128×128 skin texture |
| Shawl / 披肩 | `SHAWL` | Existing Studio path; verify texture contract |
| Coat / 外套 | `COAT` | Existing Studio path; verify texture contract |
| Cape / 披风 | `CAPE` | Separate back equipment; never merge into the skin PNG |
| Hat / 帽子 | `HAT` | Native head outer-layer mesh; isolated head UV atlas region; fixture review pending |
| Pants / 裤子 | `PANTS` | Native left/right leg outer-layer meshes; isolated leg UV atlas regions; fixture review pending |
| Shoes / 鞋子 | `SHOES` | Two independent boot box meshes attached to animated leg pivots; dedicated lower-leg UV islands; fixture review pending |
| Other accessory | `OTHER_ACCESSORY` | Not enabled until a concrete renderer contract exists |

披肩、外套、披风 are distinct product concepts and must remain distinct storage categories. In particular, a cape is independent back equipment and is excluded from skin PNG export.

## 3. Texture contract required before enabling a category

Do not infer that every 64×64 PNG can be composited with the same set of rectangles. For each enabled garment category, the implementation must declare and validate:

1. Accepted MIME type and dimensions.
2. Model compatibility: Classic, Slim, or both; if both, whether separate textures are required.
3. UV layout and the exact target regions, including front/back, left/right, and inner/outer surfaces as applicable.
4. Layer semantics: whether the texture replaces base pixels, occupies the skin outer layer, or is rendered as a separate 3D object.
5. Alpha behavior and pixel-art sampling rules (nearest-neighbor; no smoothing).
6. Preview renderer and export behavior.
7. Whether the item can coexist with other categories and the deterministic layer order.
8. A known-good fixture texture and expected rendered/exported output.

A category without this contract must remain visibly unavailable rather than being routed through another category's UV mapping.

### 3.1 Current verified SHAWL / COAT atlas profile

The currently integrated CapeSkinImage asset set provides category-specific full skin-atlas PNGs (for example, `*_shawl_default_64.png`, `*_coat_default_64.png`, and their Slim / 128px variants). Its example renderer composites the selected category PNG over the skin canvas as a complete alpha atlas; it does not crop both categories through a shared six-rectangle mask.

Therefore the current supported profile is:

| Category | Source asset namespace | Atlas contract | Runtime composition | Coexistence |
|---|---|---|---|---|
| `SHAWL` | Shawl-specific PNGs | Full 64×64 or 128×128 Minecraft skin atlas; Classic/Slim source variant | Draw the complete alpha atlas at native dimensions | Exclusive with `COAT` |
| `COAT` | Coat-specific PNGs | Full 64×64 or 128×128 Minecraft skin atlas; Classic/Slim source variant | Draw the complete alpha atlas at native dimensions | Exclusive with `SHAWL` |
| `CAPE` | Cape-specific PNGs | Separate cape texture / back-equipment renderer | Never composite into the skin atlas | Separate equipment slot |

The per-category UV coordinates are authored into the corresponding source PNG. CDPC must preserve those coordinates by compositing the full image with nearest-neighbor sampling and alpha; it must not guess a shared rectangular crop. Shawl and coat both affect overlapping upper-body skin surfaces, so they cannot be stacked without an explicit layered texture contract. The Studio currently replaces one with the other.

Reference implementation and source asset catalogue: https://github.com/lonelyang/CapeSkinImage

This profile does **not** authorize hats, pants, shoes, or arbitrary user PNGs to be treated as a shawl/coat atlas. Hat, pants, and shoes now use separate category render paths and UV regions described below; a category-specific known-good asset fixture and visual review are still required before production acceptance.


### 3.2 Native outer-layer and independent shoe geometry

The P0 implementation now separates the remaining three garment classes from the SHAWL / COAT full-atlas compositor:

| Category | 64×64 atlas region | Geometry / preview | Standard skin PNG |
|---|---|---|---|
| HAT | Head outer-layer island: x=32, y=0, w=24, h=16 | skinview3d head outer-layer mesh; single-item preview hides inner skin and all non-head outer layers | Copy only the head outer-layer UV island |
| PANTS | Right leg outer-layer island: x=0, y=32, w=16, h=16; left leg: x=0, y=48, w=16, h=16 | Native right/left leg outer-layer meshes; single-item preview isolates both legs | Copy only the two leg outer-layer UV islands |
| SHOES | Right lower-leg island: x=0, y=40, w=16, h=8; left lower-leg island: x=0, y=56, w=16, h=8 | Two independent 4.75-unit box meshes, each attached to its own animated leg pivot; each mesh samples only its own 4×4×4 lower-leg UV island | Copy only the shoe UV islands into the standard outer-leg atlas |

All coordinates and region dimensions scale by 2 for 128×128 textures. Shoe geometry is separate in the live preview so it can be sized and animated independently; the exported PNG still uses standard Minecraft outer-leg UV pixels and does not contain custom mesh data. Hat and pants use skinview3d's existing native outer-layer meshes rather than creating duplicate character rigs.

The upload and backup paths recognize HAT, PANTS, and SHOES; outfit validation accepts those canonical asset categories. The compositor clips hat/pants/shoe overlays to their own UV regions so unrelated pixels in an uploaded atlas cannot overwrite other skin regions. Shoes are excluded from the character's base skin-map composite and rendered with their own texture material.

**Verification boundary:** unit tests cover the 64/128 UV region coordinates and compatibility rules. A browser regression now uploads a controlled shoe fixture, checks that two shoe meshes are attached to the live Studio canvas, opens the isolated preview, and exports a 64×64 vanilla skin PNG. This does not yet replace visual inspection of real artist-authored shoe, hat, and pants textures in both Classic and Slim models.

## 4. Runtime architecture

Keep the rendering responsibilities separate:

- **Catalog** owns category metadata, item identity, attribution, and source URL.
- **Texture adapter** validates the category-specific texture contract and produces a normalized render descriptor.
- **Single-item renderer** displays one item in isolation using its declared renderer.
- **Character try-on renderer** applies the normalized descriptor to the current character immediately.
- **Outfit compositor/exporter** composes only exportable skin layers into a 64×64 or 128×128 PNG, preserving the base skin's native dimensions. Separate equipment such as capes is reported as excluded and may have its own asset export path.

The same normalized descriptor must be consumed by preview and export. Do not maintain separate, subtly different hard-coded UV rectangle lists in the preview and export code.

## 5. Interaction requirements

- Selecting an item updates the character preview without requiring a second confirmation.
- Selecting an item in the catalog also opens its isolated 3D asset preview in the catalog area; the outfit-list preview action is only a secondary shortcut.
- Selecting a different item in the same exclusive slot replaces the previous item.
- Selecting the active item again removes it.
- Removing an item updates both the character preview and selected-item list.
- Imported skin texture and model (Classic/Slim) remain the base of every try-on operation until explicitly changed.
- Failed texture loading leaves the last valid preview intact and shows an actionable error; it must not silently mark the item as equipped.
- A category that has no compatible renderer cannot be selected as if it were functional.

## 6. Persistence and recovery requirements

- Persist stable asset IDs and category values, not only browser-local URLs.
- Validate asset ownership and category compatibility on the server when saving an outfit.
- Save the outfit and active workspace pointer consistently; if the pointer update fails, show a recoverable state and do not claim the entire operation succeeded.
- Cover partial upload failure, outfit write failure, workspace update failure, refresh, cross-device restore, and deletion of an active outfit.
- Local drafts are explicitly device-local and must not be described as cloud-synced.

## 7. P0 acceptance checklist

- [ ] Each enabled category has a reviewed texture contract and fixture.
- [ ] Unsupported categories are not falsely advertised as selectable.
- [ ] Single-item preview is visibly distinct from full-character try-on.
- [ ] Try-on uses the imported base skin and updates immediately.
- [ ] Preview and PNG export use the same category adapter/compositor.
- [ ] Classic and Slim compatibility is tested for each supported category.
- [ ] Cape remains separate from standard skin PNG export.
- [ ] Alpha edges and pixel alignment are tested with known-good fixtures.
- [ ] Save/restore and cross-device tests cover partial failures and ownership boundaries.
- [ ] Browser tests assert rendered output/state, not merely that a route or button exists.

## 8. Current source audit (2026-11-07)

The P0 branch maps SHAWL, COAT, CAPE, HAT, PANTS, and SHOES to distinct Studio render paths. Hat and pants use native outer-layer model geometry with category-clipped UV composition; shoes use two custom box meshes attached to the animated leg pivots. The catalog still has no bundled hat/pants/shoe preset pack: those categories are available for user-uploaded assets. Production acceptance remains pending real asset fixtures and visual review.

The non-cape preview and export paths now composite the full category-authored skin atlas with alpha; the former shared six-rectangle crop has been removed. SHAWL and COAT have separate category profiles and are mutually exclusive because their source atlases overlap on upper-body surfaces. Cape remains a separate back-equipment texture.

A second SkinViewer surface now renders a selected item in isolation by applying its own texture to the 3D skin geometry with transparent skin materials; the base character skin is not composited into this preview. The catalogue thumbnail remains a fast-scan image only.

Playwright coverage has been added for isolated preview canvas creation, category exclusivity, 128×128 editor import/undo/redo/cloud restore/export, server-backed Studio outfit restore from an empty local cache, and wardrobe PNG upload/download. These tests use controlled API and texture fixtures. They do not replace visual review of every real upstream texture file, real-account cross-device testing, or a production object-storage check.

The current atlas approach preserves the UV layout encoded in each source PNG; it does not claim a pixel-by-pixel source-asset fixture audit. Before marking the full rendering acceptance complete, visually inspect the actual SHAWL/COAT Classic and Slim textures at 64px and 128px and record expected screenshots/fixture hashes. Hat, pants, shoes, and other accessories remain disabled until their own UV/geometry fixtures are reviewed.

## 9. Asset provenance and download rights

Preview permission and download / redistribution permission are separate capabilities. A texture being visible in Studio or usable for try-on does not grant permission to export, download, include in a backup, or redistribute its bytes.

Required policy:

- **Official Mojang/Microsoft cape assets** may be shown for preview or try-on only where the applicable terms allow it. CDPC must not offer an app download/export path or include the original texture bytes in outfit JSON backups.
- **User-created original cape assets** may be downloaded by their owner. Other users may download them only when the owner has explicitly granted a compatible license / download permission; PRIVATE assets remain owner-only.
- **Licensed community assets** follow their recorded license scope. Attribution must be preserved wherever the license requires it.
- **Third-party or unknown-provenance assets** default to no download / redistribution until rights are verified.
- A UI-hidden button is not an authorization boundary. Every download endpoint, bulk export, outfit backup, and asset-file response intended for download must enforce the policy on the server. Preview delivery must be a separately authorized capability and must not be mistaken for a downloadable original.
- Outfit JSON may preserve an allowed asset reference and provenance metadata, but must not embed or expose protected official texture bytes or bypass a private asset's ownership boundary.

The current Asset record has source, visibility, licenseId, and attribution; this is not yet a complete rights model. Before enabling downloadable cape assets, add an explicit provenance / download-policy representation (or an equivalently strict normalized policy), persist it on the server, and test authorization against the acting user and asset owner. Do not infer permission from source=UPLOAD alone.

Required automated cases:

1. Official cape: preview path follows allowed display scope; download endpoint rejects.
2. Official cape: outfit JSON backup does not contain texture bytes or a reusable unrestricted download URL.
3. Alternate asset APIs and bulk export cannot bypass the restriction.
4. Original user-created cape: owner can download and back up the asset.
5. PRIVATE original cape: another user cannot download it.
6. Licensed community cape: download is allowed only within the recorded license scope.
7. Unknown provenance: download is denied by default.


## 10. Implemented download authorization (2026-11-07)

- PostgreSQL `Asset` now stores `provenance` (`USER_CREATED`, `OFFICIAL`, `LICENSED`, `THIRD_PARTY`, `UNKNOWN`) and `downloadPolicy` (`DENY`, `OWNER_ONLY`, `LICENSED_PUBLIC`). Existing records migrate to the conservative `UNKNOWN` + `DENY` state.
- Uploads default to non-downloadable. The uploader must explicitly confirm ownership of the original work before the API records `USER_CREATED` + `OWNER_ONLY`; `source=UPLOAD` alone is never treated as proof of rights.
- `/api/assets/:assetId/download` is a separate authenticated endpoint. It permits an original creator to download their own private asset, and permits licensed public downloads only with a `licenseId`, PUBLIC visibility, and the explicit `LICENSED_PUBLIC` policy.
- OFFICIAL assets are denied by the stored-file preview endpoint and download endpoint. If an official cape is shown in a preview, its display source must be separately authorized and must not be the downloadable original bytes.
- The wardrobe UI now requires an explicit originality / rights declaration to enable owner downloads and hides the download action for assets without an effective download permission.
- Automated E2E coverage has been added for unknown-provenance denial, owner download of an explicitly declared original cape, cross-user denial for a private cape, and OFFICIAL preview-file / download denial. The latest CI run is the acceptance gate; JSON backup and alternate endpoint bypass audits remain open.


## 11. Portable outfit backup import hardening (2026-11-08)

- Backup import now normalizes asset references through `src/domain/outfit-backup.ts`; imported `fileUrl` and `texture` values are rebuilt as same-origin `/api/assets/:id/file` routes from a validated asset ID. Arbitrary external URLs from a JSON backup are never loaded as an outfit asset.
- Asset ID and assetId must match, category must be one of SHAWL / COAT / CAPE, duplicate IDs are removed, and the imported reference count is bounded. Official-provenance assets are omitted from portable backups.
- Imported download permission is always false; a backup cannot grant itself `canDownload` or change server-side authorization. The download endpoint remains the authority.
- Skin asset references are accepted only as relative CDPC asset-file routes; external absolute URLs, protocol-relative URLs and embedded data URLs are rejected as cloud skin references.
- Unit coverage: canonicalized URLs, mismatched IDs, unsupported categories, official-asset omission, forged download flags, duplicate/bounded references and skin URL allowlisting.


## 12. Outfit backup pose round-trip (2026-11-08)

- Fixed a persistence gap: portable outfit JSON now includes the selected character pose, and importing a backup restores that pose in Studio rather than silently reverting to the default.
- Playwright regression coverage asserts the exported pose and the restored action selector value.
