# Asset provenance

## White Ninja idle prototype — preview only

- Supplied by the user on 2026-10-29 in `shadow-clash-white-ninja-idle.zip`, with a standalone matching `white_ninja_idle_sheet.png` and integration instructions.
- Runtime copy: `apps/client/public/assets/white-ninja/white_ninja_idle_sheet.png`.
- Public URL: `/assets/white-ninja/white_ninja_idle_sheet.png`; loaded only by `/asset-preview.html`.
- Unmodified SHA256: `fc52ae1a52d2f7e53df6eb4948d608f3c0647c244f5ba23440a2cc111ff5cfb8` (source and repository copy match).
- Source pack README identifies `reference/white_ninja_master.png` as the original character reference. Frames are subtle local image deformations for breathing/head/ponytail movement, **not independently generated key poses or final hand-authored animation**.
- Sheet: RGBA PNG, 2048×512; four horizontal 512×512 frames in order 0,1,2,3; loop at 3 FPS, repeat -1. Origin `(0.5,496/512)`.
- At alpha ≥16, visible bottoms are row 495 in all four frames; tops are 28,26,27,29. The preview uses visual scale `84/470` to put the tallest visible silhouette at approximately 84 logical pixels, anchored to the fixed floor. Slight upper-silhouette height variation belongs to the supplied deformation.
- The PNG is copied exactly; no source pixels, transparency, pose frames or artwork have been generated or edited for this import.
- Preview scene uses a fixed spawn reference from existing balance constants. It has no Socket.IO connection, match, physics engine or authority over gameplay. Live PvP still renders its original placeholders.
- Other pack illustrations, Mayon stage, Black Ninja reference, per-frame images and animated previews are not runtime imports in this task.
