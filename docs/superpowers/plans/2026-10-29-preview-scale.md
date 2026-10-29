# White Ninja preview scale optimization plan

**Spec:** User's M4-preview visual-scale follow-up. AGENTS.md, PRD.md and the original preview verification report read in full. Base `1e5f5da`, existing feature branch `codex/white-idle-preview`; commit and push verified changes to this branch.

**Design:** Separate visual height (84/140/180/220 logical pixels, default 180) from the fixed 48×84 collision reference. Apply uniform `height/470` scale to the unchanged 512×512 frames with origin `(0.5,496/512)`. Keep spawn `(400,600)`, all four 3 FPS looping frames, fixed 1280×720 camera, modes, backgrounds and flip. Report estimated visible-silhouette overhang based on the supplied alpha bounds (x104..420, top26, foot496). No live game/server/shared/art changes.

- [x] Add a failing scale-selector/default/anchor regression; extend layout capture to all 4 heights ×3 desktop sizes.
- [x] Add the selector and uniform scaling, render selected height and overhang measurements; preserve every rendering mode/facing/background at all heights.
- [x] Sample real animation frames at every scale, verifying fixed foot, camera, box, proportions, sprite bounds, repeat/order, and unchanged source alpha.
- [x] Execute typecheck, unit/integration suite, full Playwright suite, build and built-preview smoke. Preserve server/shared/live game/PvP test sources and exact PNG hash.
- [x] Inspect 12 comparison screenshots plus overlays/backgrounds, document recommendation and future collision/camera work; perform independent review.
- [x] Commit and push verified changes, confirm remote SHA, stop for visual approval. No deployment or new animation frames.

**Verification ledger:** TDD RED (missing selector) → GREEN (4 preview tests). Initial focused selector locators included nested option text when matched by exact label; role/name matching fixed the test locator. Final checks: typecheck/build pass; 35 unit/integration and 9 browser tests pass; built-preview smoke 12 size/viewport cases passes, source hash unchanged. 40 matrix captures generated, 22 plus 2 production captures committed for review. All 12 dark size comparisons and representative overlays/transparency captures inspected; 220 recommended for readability, requested default remains 180.

**Review focus:** Scale is visual only. Check uniform scaling, true default, alpha-bound overhang math including flip, body/transparent-frame bounds and foot origin. Check no server/shared/live game/PNG/PvP test changes. Source loading failure and preview page reload retain existing behavior. Reject unsupported numeric heights; no new mobile/touch, non-Chromium or live sprite integration guarantees. Production hook must stay absent. Full-page screenshots may exceed the viewport vertically; canvas/horizontal overflow must not.

**Final review:** One fresh read-only review of `1e5f5da..148bc25` approved push, no Critical/Important/Minor findings, no fixes requested. Implementation `148bc25b266c228a72da42595a9829b912f171e7` pushed to the feature branch and remote SHA verified. This documentation follow-up is pushed afterward; final SHA recorded in handoff. No merge/deployment.

- Final: Ruling: Final animation quality / 220px preference — recommend from measured captures, leave final artistic approval to the user; no further work before that approval.
- Final: Ruling: Live collisions/contact, wall/jump/launch and two-fighter framing — excluded from standalone preview; limitations and later checks explicitly documented, existing gameplay preserved.
- Final: Ruling: Mobile/touch, other browsers, physical devices, public internet and deployment — outside requested desktop/local proof; no unsupported verification claims made.
- Final: Ruling: External provenance/authenticity — supplied asset and exact hash preserved and recorded; independent external authenticity/ownership audit was not part of this import/scale task.
