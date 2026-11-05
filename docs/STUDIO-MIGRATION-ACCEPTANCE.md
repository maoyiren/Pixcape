# Studio migration acceptance checklist

This checklist protects the existing 3D outfit workflow while routes converge on `/studio`.

## Preserved implementation

- `app/studio/page.tsx` renders the existing `DressUpStudio`; it does not replace the editor or introduce a second 3D engine.
- Local outfit drafts remain in `cdpc:dress-up:outfits-v1` and `cdpc:dress-up:local-v1`; local snapshots preserve embedded skin PNGs and cloud skin asset IDs/URLs.
- Signed-in cloud outfits remain backed by `/api/outfits`; the active outfit pointer remains in the per-user `WorkspaceState`.
- Wardrobe asset handoff remains backed by `/api/workspace` (`activeAssetId` / `activeOutfitId`).
- Shawl, coat, and cape remain separate categories (`SHAWL`, `COAT`, `CAPE`).

## Route and handoff acceptance

| Scenario | Expected result |
| --- | --- |
| Open `/studio` | Existing 3D editor initializes with its original controls and catalog |
| Open legacy `/dress-up` or `/workbench/dress` | Redirects to `/studio` |
| Choose a skin in the wardrobe | Workspace pointer stores the asset ID; Studio loads it as the base skin |
| Choose a shawl, coat, or cape | Workspace pointer stores the asset ID; Studio equips it in the matching category |
| Choose a saved cloud outfit | Workspace pointer stores the outfit ID; Studio restores its skin, model, background, and equipped assets |
| Save a cloud outfit | Assets are persisted first, outfit is created/updated, and active outfit pointer is updated |
| Reopen Studio | Active cloud outfit is restored for the signed-in user |
| Save/restore a local draft | Existing browser-local draft format remains readable |
| Use Studio while signed out | Local editing remains available; cloud endpoints return the existing authentication response |

## Required automated/manual regression before release

- [ ] Next.js production build and typecheck
- [ ] Browser test: skin + shawl + coat + cape preview and model switch (Steve/Alex)
- [ ] Browser test: local save, reload, restore, export/import backup (including a selected cloud skin asset and an imported PNG skin)
- [ ] Browser test: signed-in cloud save, update, delete, restore after reload
- [ ] Browser test: wardrobe asset handoff and saved-outfit handoff to Studio
- [ ] API test: user A cannot read, update, or delete user B's private outfits/assets
- [ ] API test: public assets can be used without exposing private assets
- [ ] Docker image build and startup migration smoke test

## Validation status

Source inspection only. The checks above are intentionally unchecked until actually executed in CI or a browser/Docker environment.
