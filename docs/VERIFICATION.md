# M0/M1 verification

Date: 2026-10-29. Local Windows run with Node 22.23.3, npm 10.9.9, Phaser 4.2.1, Socket.IO 4.8.4, Vitest 5.0.5 and Playwright 1.64.1 (Chromium).

| Check | Executed result |
| --- | --- |
| `npm install` | Passed; 92 packages installed, audit reported 0 vulnerabilities |
| `npm run typecheck` | Passed; strict shared/server/client/test TypeScript checks |
| `npm test` | **25 passed, 0 failed**, 2 files (12 simulation + 13 real socket integration tests) |
| `npm run build` | Passed; shared and Node output plus Vite production client |
| `npx playwright install chromium` | Passed |
| `npm run test:e2e` | **2 passed, 0 failed**, no retries (43.7 seconds including test-service startup) |
| `git diff --check` | Passed |

## Browser proof

`tests/e2e/pvp.spec.ts` creates independent BrowserContexts with separate sockets and storage, not two views sharing one client. The first test creates a White seat, joins a Black seat, asserts the same match ID and progressing canonical ticks, moves both independently, misses outside range, blocks a punch (100 HP, 82 guard), then lands a punch (95 HP on both). Holding J causes no extra damage. Forged health/damage and malformed input cannot change HP. A third context receives Room Full. Nineteen more legal keyboard punches cause KO; both clients see White win and precisely equal snapshots at the same tick. Both reset to round two with full health and original positions. Closing Black's context ends the room visibly while the health endpoint remains available.

The second test verifies Black's punch, White's block and health synchronization, releases a held movement input via the client's actual blur handler, and confirms no further movement across subsequent heartbeats. It also verifies room leave and creation of another room.

Browser page errors and console errors are checked in the full round scenario. Screenshots of the round result and reset arena are attached by Playwright under `test-results/`.

## Unit/integration coverage

Simulation: movement/arena bounds, grounded body collision, facing, jump/gravity/landing, miss/range/startup, single hit, held-button suppression, fast press/release preservation, front block and guard damage, ground/air hitbox separation, HP clamp and KO freeze/reset, simultaneous double-KO, and unavailable air attacks.

Real TCP Socket.IO integration: secure seat assignment and capacity, duplicate seat requests, malformed codes/missing callbacks, exact input schema/sequence/ownership, rate limits, forged events, stale input expiry, isolated rooms, disconnect/closed-seat handling, resource caps and empty cleanup, oversized transport messages, unapproved origins, idle expiry and membership reuse.

## Development history and limits

- The simulation suite was first observed failing (12 tests), then passing. Room allocation was observed failing before room implementation. The browser test first failed against the placeholder UI before the Phaser client was implemented.
- One intermediate browser run was interrupted while a concurrent build rewrote shared output and Vite reloaded the client. Running typecheck/build before browser tests resolved it; final browser tests passed without retries. Do not rebuild shared output concurrently with the browser proof.
- Vite reports a large bundle warning (Phaser included; approximately 374 KB gzip). Playwright inherits a harmless FORCE_COLOR/NO_COLOR warning from the host environment.
- This is a **local online networking proof**. No deployment, physical-device test, public-internet test, latency/fairness assessment, AI or subsequent milestone is claimed.
- M1 disconnect closes a room. Reconnection, forfeit grace, guard regeneration/break, other attacks, timer, best-of-three and rematch are intentionally deferred to M2.

Final code review and startup smoke evidence will be appended after execution.
