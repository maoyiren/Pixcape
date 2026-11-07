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
| Hat / 帽子 | `HAT` | Not enabled until its UV/layer contract is defined and tested |
| Pants / 裤子 | `PANTS` | Not enabled until its UV/layer contract is defined and tested |
| Shoes / 鞋子 | `SHOES` | Not enabled until its UV/layer contract is defined and tested |
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

This profile does **not** authorize hats, pants, shoes, or arbitrary user PNGs to be treated as a shawl/coat atlas. Those categories remain disabled until independent geometry/UV fixtures exist.

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

The current P0 branch maps only `SHAWL`, `COAT`, and `CAPE` to the Studio renderer. Hat, pants, and shoes remain unavailable.

The non-cape preview and export paths now composite the full category-authored skin atlas with alpha; the former shared six-rectangle crop has been removed. SHAWL and COAT have separate category profiles and are mutually exclusive because their source atlases overlap on upper-body surfaces. Cape remains a separate back-equipment texture.

A second SkinViewer surface now renders a selected item in isolation by applying its own texture to the 3D skin geometry with transparent skin materials; the base character skin is not composited into this preview. The catalogue thumbnail remains a fast-scan image only.

Playwright coverage has been added for isolated preview canvas creation, category exclusivity, 128×128 editor import/undo/redo/cloud restore/export, server-backed Studio outfit restore from an empty local cache, and wardrobe PNG upload/download. These tests use controlled API and texture fixtures. They do not replace visual review of every real upstream texture file, real-account cross-device testing, or a production object-storage check.

The current atlas approach preserves the UV layout encoded in each source PNG; it does not claim a pixel-by-pixel source-asset fixture audit. Before marking the full rendering acceptance complete, visually inspect the actual SHAWL/COAT Classic and Slim textures at 64px and 128px and record expected screenshots/fixture hashes. Hat, pants, shoes, and other accessories remain disabled until their own UV/geometry fixtures are reviewed.
