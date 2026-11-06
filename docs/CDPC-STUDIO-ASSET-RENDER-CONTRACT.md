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
| Skin | `SKIN` | Base 64×64 skin texture |
| Shawl / 披肩 | `SHAWL` | Existing Studio path; verify texture contract |
| Coat / 外套 | `COAT` | Existing Studio path; verify texture contract |
| Cape / 披风 | `CAPE` | Separate back equipment; never merge into the skin PNG |
| Hat / 帽子 | `HAT` | Not enabled until its UV/layer contract is defined and tested |
| Pants / 裤子 | `PANTS` | Not enabled until its UV/layer contract is defined and tested |
| Shoes / 鞋子 | `SHOES` | Not enabled until its UV/layer contract is defined and tested |
| Other accessory | `OTHER_ACCESSORY` | Not enabled until a concrete renderer contract exists |

披肩、外套、披风 are distinct product concepts and must remain distinct storage categories. In particular, a cape is independent back equipment and is excluded from standard 64×64 skin PNG export.

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

## 4. Runtime architecture

Keep the rendering responsibilities separate:

- **Catalog** owns category metadata, item identity, attribution, and source URL.
- **Texture adapter** validates the category-specific texture contract and produces a normalized render descriptor.
- **Single-item renderer** displays one item in isolation using its declared renderer.
- **Character try-on renderer** applies the normalized descriptor to the current character immediately.
- **Outfit compositor/exporter** composes only exportable skin layers into a 64×64 PNG. Separate equipment such as capes is reported as excluded and may have its own asset export path.

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

The current P0 branch source maps only `SHAWL`, `COAT`, and `CAPE` to Studio categories. Hat, pants, and shoes exist in the shared domain/Prisma vocabulary but are not mapped into the Studio catalog. The current non-cape preview/export path applies one shared set of UV rectangles to all supported non-cape items. Catalog cards currently display PNG thumbnails; a dedicated single-item rendered preview has not been demonstrated.

These observations are a static source audit, not a live browser acceptance. Do not mark the P0 checklist items above complete until implementation and automated tests provide evidence.
