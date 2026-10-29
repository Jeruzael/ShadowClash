# White Ninja visual scale verification

Date: 2026-10-29. Base: `1e5f5da`. Branch: `codex/white-idle-preview`. Scope: standalone M4 asset preview follow-up; no deployment or gameplay integration.

## Implemented

- Fighter height selector: **84 / 140 / 180 / 220 logical px**, default **180**. Uniform `selectedHeight/470` scale preserves proportions of the unchanged four 512×512 frames. Height describes the tallest painted pose (alpha ≥16), not transparent frame padding.
- Existing 3 FPS loop, left/right flip, dark/light/checker backgrounds and sprite/box/overlay modes work at every height. Changing height changes scale only, without restarting the animation.
- Origin `(0.5,496/512)`, foot anchor `(400,600)`, fixed 1280×720 camera and **48×84 collision reference** remain fixed. Live PvP placeholders, server authority, combat, positions, hitboxes, room protocol and original PvP/unit test sources are unchanged.
- Readout quantifies maximum visible overhang above and on either side of the reference box; left/right measurements swap with facing. Source alpha bounds are x=104..420 inclusive, top=26, bottom=495. No source artwork or frames edited/generated.

## Recommendation and comparison

**Recommend 220px for visual approval. Keep 180px as the requested default.** At the smaller desktop viewports, 220 reads as approximately 164 CSS pixels tall, compared with 134 at 180. The face, fists, wrappings and costume silhouette are easiest to read at 220. It occupies 30.6% of the logical arena height and leaves 380 logical pixels above the tallest pose, so the fixed preview camera still has ample headroom. This is an art/composition recommendation, not approval to resize gameplay collisions.

| Logical height | Visual width, approximately | Arena height | Readability / composition / motion |
| --- | ---: | ---: | --- |
| 84 | 56.7px | 11.7% | Undersized; facial detail and breathing motion hard to distinguish; arena dominates. |
| 140 | 94.4px | 19.4% | Clear stance, but fine face/hand detail remains small at laptop FIT scale. |
| 180 (default) | 121.4px | 25.0% | Good conservative option; recognizable costume and more visible idle movement. |
| 220 (recommended) | 148.4px | 30.6% | Strongest detail/readability of these options; better use of the large arena, with safe margins and no clipping. |

All four preserve identical proportions. The loop remains deliberately subtle at every size; larger rendering makes deformation easier to see but does not add animation quality or new poses. Fine hair/cloth edges retain the source antialiasing and soften when downsampled. No new opaque matte, frame seams, sliding baseline or camera movement was observed in the reviewed captures/loop checks. Source silhouette height varies by up to three source rows (up to 1.4 logical px at 220), while its bottom/anchor stays fixed.

| Viewport | Measured canvas (CSS px) | Visible heights at 84 / 140 / 180 / 220 (CSS px) |
| --- | --- | --- |
| 1920×1080 | 1280×720 | 84 / 140 / 180 / 220 |
| 1366×768 | 955.72×537.59 | 62.7 / 104.5 / 134.4 / 164.3 |
| 1024×768 | 955.72×537.59 | 62.7 / 104.5 / 134.4 / 164.3 |

FIT letterboxing, canvas containment and zero horizontal page overflow were verified at every height and viewport. The inspection page scrolls vertically to its measurements; screenshots below are full-page captures taken with the stated browser viewport, so image height can exceed viewport height.

## Comparison screenshots

Every size at every requested viewport is committed. Each link shows the same arena, source proportions, foot position and dark background; real idle playback continues during capture.

| Viewport | 84px | 140px | 180px | 220px |
| --- | --- | --- | --- | --- |
| 1920×1080 | [84](evidence/white-idle-scale/height-84-1920.png) | [140](evidence/white-idle-scale/height-140-1920.png) | [180](evidence/white-idle-scale/height-180-1920.png) | [220](evidence/white-idle-scale/height-220-1920.png) |
| 1366×768 | [84](evidence/white-idle-scale/height-84-1366.png) | [140](evidence/white-idle-scale/height-140-1366.png) | [180](evidence/white-idle-scale/height-180-1366.png) | [220](evidence/white-idle-scale/height-220-1366.png) |
| 1024×768 | [84](evidence/white-idle-scale/height-84-1024.png) | [140](evidence/white-idle-scale/height-140-1024.png) | [180](evidence/white-idle-scale/height-180-1024.png) | [220](evidence/white-idle-scale/height-220-1024.png) |

Collision overlays at 1366×768: [84](evidence/white-idle-scale/overlay-84-1366.png), [140](evidence/white-idle-scale/overlay-140-1366.png), [180](evidence/white-idle-scale/overlay-180-1366.png), [220](evidence/white-idle-scale/overlay-220-1366.png).

Recommended-size transparency/facing checks: [checker / left](evidence/white-idle-scale/checker-flipped-220-1366.png), [light / left](evidence/white-idle-scale/light-flipped-220-1366.png). These backgrounds at 220 are also committed for 1920 and 1024 widths. Built output: [default 180](evidence/white-idle-scale/production-default-180.png), [220 overlay / left / checker](evidence/white-idle-scale/production-overlay-220.png). The layout test generates **40 captures** (12 dark, 24 light/checker flipped, 4 overlays); 22 are committed here, plus the two production captures.

## Executed verification

Windows, Playwright Chromium, existing dependencies retained. Commands ran sequentially to avoid rebuilding shared output while browser matches run.

| Check | Actual result |
| --- | --- |
| New height regression before implementation | Expected failure: selector absent. A subsequent focused run exposed an overly strict nested-label locator; using the actual combobox accessible name resolved it. |
| Focused preview Playwright suite | **4 passed, 0 failed**, 45.4s |
| `npm run typecheck` | Passed, exit 0 |
| `npm test` | **35 passed, 0 failed**, 3 files, 9.96s (unchanged combat/socket/network tests) |
| `npm run build` | Passed, exit 0; both HTML entries and unchanged PNG included |
| `npm run test:e2e` | **9 passed, 0 failed**, no retries/skips, 1.7m: 4 preview + 5 unchanged PvP/stabilization tests |
| Built `npm run preview` smoke, loopback 5175 | Passed: all 12 height/viewport combinations, all display modes/facings/backgrounds; default 180; observed sequence **0,1,2,3,0**; foot `(400,600.00)` throughout; no browser errors or sockets; test diagnostic hook absent |
| Preservation checks | Server/shared/live client/index/PvP test/source PNG diff empty against base; public/built/served PNG SHA256 unchanged |

Regression coverage checks exact selector options/default, uniform x/y scaling, full sprite bounds inside the arena, fixed box/anchor, sequential complete cycles at every height, modes at every height/facing, unchanged camera through the viewport matrix, and source transparent pixels/alpha bounds. The original two-independent-context tests still exercise movement, attack, HP/guard sync, KO/reset, room lifecycle, refresh and disconnect against the real authoritative server. No extra unit tests were needed because no simulation/business rules changed.

Production smoke ran only the built client service on loopback 5175, with no match server required; it was stopped afterward. Served/public/built SHA256: `fc52ae1a52d2f7e53df6eb4948d608f3c0647c244f5ba23440a2cc111ff5cfb8`.

Non-failing diagnostics: existing large Phaser common-chunk warning (357.59 KB gzip), inherited FORCE_COLOR/NO_COLOR warning, and Vite WebSocket ECONNABORTED logs during deliberate PvP socket teardown. All checks above completed successfully.

## Remaining limits and future decisions

At 220, the visible envelope extends **47.1px left, 53.2px right, 136px above** the box when facing right (sides swap facing left). At 180 it extends **34.2px left, 39.2px right, 96px above**. The current box covers only the lower part of the larger art. Future live integration must deliberately reconcile hurtboxes, attack reach, body separation and perceived contact; using these larger sprites unchanged with the old collision geometry would be misleading. No collision changes are authorized or made here.

No camera adjustment is needed for this single-character preview at any offered height. A later gameplay task must check two larger fighters near walls, jumping/launching poses and HUD/FX clearance before deciding whether camera framing or arena scale needs adjustment. This idle-only test cannot settle those questions.

The pack remains a subtle **image-deformation prototype derived from the supplied original reference**, not independent AI-generated key poses. Rigging/manually authored frames may be needed for further animation. No walk/punch/Black Ninja frames, Mayon stage, PvP sprite replacement or M2 mechanics added. Tests cover local desktop Chromium; physical-device, other-browser and public-internet multiplayer verification are not claimed. No services deployed or exposed publicly.

## Run locally

From the repository root, run `npm run dev`, then open **http://127.0.0.1:5173/asset-preview.html**. Select a height; compare all three Display modes, both facings and backgrounds. Watch the frame counter and foot/overhang measurements. Use 220 to review the recommendation; a fresh page defaults to 180.

For built preview, run `npm run build` and `npm run preview`, then open the same path (default port 5173). The standalone page requires no match server; returning to Play game needs the normal `npm run dev` services or `npm start` alongside preview. Keep loopback defaults for local inspection. Stop here for visual approval before further integration.

## Commit and independent review

Implementation commit **`148bc25b266c228a72da42595a9829b912f171e7`** was pushed to `codex/white-idle-preview` and its remote SHA confirmed. A follow-up documentation commit records this result and review.

One fresh, read-only review of `1e5f5da..148bc25` approved the feature branch for push with **no Critical, Important or Minor defects** and no corrective changes requested. It covered the complete diff, reference documents and six screenshots covering all heights/viewports and representative modes/backgrounds. The reviewer independently checked preservation diffs, PNG hash, whitespace, clean state and absence of the diagnostic hook from production output; it inspected the executed test evidence without rerunning suites. Final artistic size/quality approval remains with the user; excluded live integration and device/browser/network contexts remain future work. Approval to push does not authorize merging or deployment.
