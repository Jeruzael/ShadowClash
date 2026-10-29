# White Ninja idle asset preview implementation plan

**Goal:** Import the supplied four-frame deformation prototype into an isolated Phaser preview, then verify alignment, transparency and desktop scaling without changing live PvP.

**Spec:** User's M4-preview-only request, repository PRD/AGENTS, and asset-pack README read in full. Standing authorization requires committing and pushing verified work.

**Design:** Add a separate `/asset-preview.html` Vite entry point and scene with no networking or match simulation. Read existing balance constants only for a fixed spawn/floor and 48×84 reference box. Load the unmodified PNG at a stable public asset path. Play frames 0..3 at 3 FPS, origin `(0.5,496/512)`, scale `84/470` so the tallest provided visible silhouette is about 84 logical pixels. Toggle sprite/reference/overlay, flip facing, and inspect dark/checker/light backgrounds. Keep a fixed camera and responsive FIT letterboxing.

## Asset observations

- Source PNG: 2048×512 RGBA, transparent corners; SHA256 `fc52ae1a52d2f7e53df6eb4948d608f3c0647c244f5ba23440a2cc111ff5cfb8`.
- At alpha ≥16 all four frames end at row 495 (anchor row 496); tops are 28,26,27,29. Thus feet stay fixed while the upper silhouette subtly deforms.
- This is a user-supplied image-deformation prototype, not independently generated key poses. No new art, attacks, walking/Black animations or Mayon integration.

## Task 1 — Preview and asset import

- [x] Add new browser acceptance tests first and observe the missing preview fail.
- [x] Copy only the exact idle PNG into `apps/client/public/assets/white-ninja/` and record source/provenance in `docs/ASSETS.md`.
- [x] Implement standalone HTML, small preview UI/styles, scene and read-only test-mode diagnostics. Configure Vite's two HTML build inputs. Do not edit the game entry point or FightScene.

## Task 2 — Acceptance and delivery

- [x] Verify all frames/order/repeat/3 FPS, constant foot/origin/scale/reference box across animation and flip, alpha-channel bounds, and no preview socket connection or live-PvP asset load.
- [x] Test 1920×1080, 1366×768 and 1024×768; capture box/sprite/flip/background screenshots. Inspect visual issues honestly.
- [x] Execute `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Preserve all existing test files and server/shared/game sources unchanged.
- [x] Smoke-test the built standalone page; independent read-only review; document actual results and remaining issues; commit and push the task branch. No deployment.
