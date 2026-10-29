# White Ninja idle asset preview verification

Date: 2026-10-29. Base: `1465e01`. Scope: isolated M4 asset preview only; live M0/M1.1 gameplay remains unchanged.

Historical import report at 84px. For the subsequent selectable-size preview, current results and all-size screenshots, see [visual scale verification](WHITE-IDLE-SCALE-VERIFICATION.md).

## Implemented

- Separate `/asset-preview.html` Vite entry, Phaser scene and preview UI. No Socket.IO client, live match or physics simulation in this page.
- Exact user-supplied RGBA sheet copied to `/assets/white-ninja/white_ninja_idle_sheet.png`; source, public and built copies match SHA256 `fc52ae1a52d2f7e53df6eb4948d608f3c0647c244f5ba23440a2cc111ff5cfb8`.
- Four 512×512 frames (0..3), 3 FPS, repeat -1, origin `(0.5,496/512)`. Fixed spawn reference `(400,600)`, visual scale `84/470` for approximately 84px visible height. Existing 48×84 box and all world/gameplay constants remain unchanged.
- Sprite/physics-box/overlay modes, facing flip, and dark/checker/light backgrounds. Fixed logical 1280×720 camera with responsive FIT letterboxing.
- Asset provenance and prototype nature documented in [ASSETS.md](ASSETS.md). It is a subtle image-deformation prototype derived from the supplied reference, **not independent AI-generated key poses**.

## Executed checks

Windows; Node 22.23.3, npm 10.9.9; existing Phaser 4.2.1 and pinned dependencies retained.

| Check | Actual result |
| --- | --- |
| Initial preview regression before implementation | Failed because the preview/status did not exist |
| `npm run typecheck` | Passed |
| `npm test` | **35 passed, 0 failed**, 3 files; original combat/socket/network tests unchanged |
| `npm run build` | Passed; both `index.html` and `asset-preview.html` built, PNG copied unchanged |
| `npm run test:e2e` | **8 passed, 0 failed**, no retries; 1.3 minutes (5 original PvP/stabilization tests + 3 new preview tests) |
| Production `npm run preview` smoke | Passed on loopback 5175: all four real frames observed, controls/foot readout correct, exact served PNG hash, no browser errors/websockets and no test diagnostic hook |
| Source-preservation diff | Server, shared package, live client `main.ts`/`scene.ts` and original `pvp.spec.ts` unchanged from base |

The new browser tests sample nine frame transitions (more than two loops), check sequential frame order/repetition and 3 FPS configuration, and confirm constant sprite x/y, origin, scale, painted-foot reference, box and camera through animation, display toggles and flip. Source-alpha inspection confirms transparent corners, over 100,000 fully transparent pixels per frame, fixed visible bottom row 495, and top rows 28/26/27/29 (alpha ≥16). The fixed row-496 origin keeps the rendered feet at the same world baseline.

Desktop checks cover **1920×1080, 1366×768 and 1024×768**, including real canvas bounds/aspect ratio, letterboxing, horizontal page overflow, fixed camera and unchanged box. The preview makes no Socket.IO connection; navigating to the normal game proves it never requests the preview sheet/module. The original full two-context authoritative PvP/KO/round-reset tests still pass without modifying their source.

Production smoke ran only the built client preview service; no match server was started for that smoke. All four frame numbers changed in the live production page, overlay/left-facing/checker controls worked, and the served asset retained its source hash. The temporary production preview service was stopped afterward.

The build retains the existing large Phaser common-chunk warning (about 358 KB gzip). Playwright inherits a FORCE_COLOR/NO_COLOR warning; Windows Vite may log ECONNRESET when a browser socket closes during teardown. All tests completed successfully.

## Before/after screenshots and visual review

- [Before — fixed physics box](evidence/white-idle/before-box-1366.png)
- [After — idle sprite, right facing](evidence/white-idle/after-sprite-1366.png)
- [Checkerboard, left facing](evidence/white-idle/checker-flipped-1366.png)
- [Light background, left facing](evidence/white-idle/light-flipped-1366.png)
- [Built production preview](evidence/white-idle/production-preview.png)

The complete 12-image desktop set is produced under `test-results/` by the preview layout test. The selected screenshots above are committed for review. Observed: feet remain on the same floor marker, flip does not shift the origin/camera, letterboxing is stable and the canvas stays inside its container. No opaque background rectangle or newly introduced alpha matte was observed on dark/light/checker backgrounds.

Remaining visual limitations: this breathing/deformation motion is intentionally very subtle, especially at the current 84px logical fighter height. Fine hair/fabric/outline detail softens when downsampled. The stance silhouette is slightly wider than the 48px collision reference; that is a visual overhang, and the box has not been expanded to match it. The original PNG, including its edge antialiasing, is retained exactly. These observations do not establish final animation quality.

Mayon-stage rendering, punch/walk/Black Ninja animations, asset generation, live PvP sprite replacement, M2 combat, deployment, separate-device and public-internet testing are not included or claimed.

## Open locally

Run `npm run dev`, then open **http://127.0.0.1:5173/asset-preview.html**. For built output, run `npm run build`, then `npm run preview`; the same path works. No game server is required for the standalone preview. The Play game link returns to the existing PvP page, which requires its normal Node server.

## Independent review

One independent read-only review of `1465e01..83b6e83` approved the change with **no Critical, Important or Minor defects**. It checked all changed code/build configuration/tests, source-asset hash, documentation and selected committed screenshots. No corrective changes were requested. The reviewer did not independently rerun tests/services; the executed results above are implementation evidence. External source-pack authenticity/licensing beyond recorded provenance, final animation quality, unsupported devices/browsers, public internet and excluded gameplay/art milestones were not established by this review.
