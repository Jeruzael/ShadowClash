# AGENTS.md — Shadow Clash local coding agent instructions

These are **always-on workspace rules** for the Shadow Clash repository. They apply to any AI coding agent working in this folder, including Google Antigravity. **Read `PRD.md` in full before implementing anything.** Do not interpret this file as an instruction to modify unrelated repositories.

## 1. Mission and delivery priority

Develop the browser-based 2D ninja fighter described in `PRD.md`. The user explicitly wants a **small, playable, online PvP / PvE game**, not an expansive game platform.

**Absolute top priority:** Prove that **two separate browser contexts** join the **same server-authoritative 1v1 match**, with synchronized movement, at least one hit/block, health, and a round result. Use placeholders and keep design simple.

**Do not** spend the first iteration generating images, building a fancy lobby, adding accounts, or finishing the entire moveset before this online proof works.

## 2. Operating boundaries

1. Inspect the current working tree and `PRD.md` first. If the directory is empty, create a new project here. If code already exists, preserve useful work and avoid destructive rewrites.
2. Make the smallest reasonable implementation that meets the milestone. Avoid speculative abstractions and extra dependencies.
3. Use a current maintained Node.js LTS and npm workspaces. Use **strict TypeScript** end-to-end. Prefer Phaser 4.x for the client if the selected version's documented APIs work; pin a tested stable version and avoid mixing Phaser 3/4 examples. Use Socket.IO 4.x for live rooms. Use Vitest and Playwright for tests.
4. **No database, authentication service, AI API, third-party payments, chat system, or graphical asset generator is needed to satisfy the first milestone.** Never add them without a confirmed requirement.
5. You may edit code, install project-local dependencies, run local scripts/tests, and create local Git commits. After completing a repository task and passing its applicable checks, commit the task changes and push the current task branch to `origin`. The user authorized this standing commit-and-push workflow on 2026-10-29; no further confirmation is needed for routine task pushes. Do not force-push, merge, publish/deploy the game, buy services, modify global machine settings, expose a network port publicly, or delete user data without separate explicit user authorization.
6. Do not introduce secrets or credentials. Use `.env.example` for documented nonsecret configuration and ignore actual `.env` files in Git.
7. Prefer original placeholder art made with Phaser shapes. Any later outside artwork must be legally usable with provenance.
8. Do not claim a feature or test passed unless you executed a relevant check and recorded the result. State when browser/internet testing is unavailable.
9. When a choice is underspecified, select a conservative default consistent with `PRD.md`, document it, and continue rather than repeatedly asking routine questions.

## 3. Technical boundaries (non-negotiable)

- **Simulation:** An explicit fixed-tick, headless TypeScript combat simulation containing state, movement, moves, hitboxes, blocking, damage, timers, and win conditions. No Phaser dependency in authoritative game rules. No time-critical combat outcomes determined using client animation callbacks.
- **Server:** Node.js owns all matches, session/seat allocation, input validation, collision resolution, health, guard, timers, round winners, and AI decisions. Use one authoritative 60 Hz simulation loop per active match or an equivalent safe scheduler; avoid one timer per fighter/action.
- **Client:** Phaser handles input capture, display, animation, HUD, and audio. Render server snapshots (approximately 20 Hz), target 60 FPS visuals, interpolate remote visuals when sensible. Client-side hit effects are decorative; **only the server damages fighters**.
- **Protocol:** Shared typed event/payload definitions. Clients send constrained input intents plus monotonic sequence IDs; never trust client positions, HP, damage, moves already resolved, or declared victory. Validate input size, types, ranges, session ownership, and rate. Server tags canonical snapshots with match ID and tick.
- **PvP:** Socket.IO room for each match, separate application-level room/seat state. Max 2 humans per match. Private code ≠ authorization to replace an occupied seat. Reconnect tokens must be securely generated and validated.
- **PvE:** Rule-based AI emits the same legal input intentions as a human and passes through the same state machine; no direct health mutation, no model inference at runtime.
- **Correctness:** Prevent duplicate hit registration, illegal state transitions, input held-button spam, room leakage, duplicate queue seats, negative HP, and two clients seeing contradictory official winners.
- **Reproducibility:** Configurable balance constants stored in a single shared module. Prefer tick-based timing over `Date.now()` for combat. Keep tests independent of rendering.

## 4. Suggested architecture and scripts

Use the simple `apps/client`, `apps/server`, and `packages/shared` npm-workspaces layout in `PRD.md`; adjust only if a demonstrably simpler structure delivers the same separation. The repository root should have:

- `npm run dev` — launches client and server together for local development.
- `npm run test` — runs unit/integration suites.
- `npm run test:e2e` — runs browser E2E tests (and starts required local services or documents the prerequisite).
- `npm run typecheck` — checks all TS projects.
- `npm run build` — makes production client/server builds.
- `README.md` — setup, ports, environment, gameplay controls, testing, deployment constraints, known limitations.
- `.env.example` — client URL, server port, allowed origin, etc. Do not assume a static host can run the Node/Socket.IO process.

Use simple, clearly named modules. Do not introduce React, Redux, a full physics engine, a database ORM, Kubernetes, or microservices just to render two fighters.

## 5. Implementation sequence: work milestone by milestone

### M0 — Scaffold and isolated core

1. Make the workspace/package structure and document basic local commands.
2. Implement an isolated `GameState`, `FighterState`, `InputState`, and tick update in the shared package.
3. Implement a simple arena (screen boundaries + floor), gravity, movement, facing, health, one punch with hitbox, and a basic block. Use plain colored rectangles with White/Black labels.
4. Create a Phaser scene and a Node + Socket.IO entry point. Client state must be able to render server-fed snapshots.
5. Add tests for movement bounds, hit inside/outside range, block, one hit per attack, and KO/round reset.
6. Run `npm install`, `npm run typecheck`, `npm run test`, `npm run build`, and verify the development startup command.

### M1 — First proof of **real two-browser online PvP**

1. Implement private `room:create`, `room:join`, room-full handling, and authoritative seat assignment. First player is White, second is Black.
2. Send only typed movement/action intents from the controlling client; run combat on the server; broadcast snapshots to the two clients.
3. Add small HUD: each player's health, guard, room code, status, round results, and instructions.
4. Confirm both browsers show the same starting positions, movement, accepted hit damage, block guard reduction, KO, and reset.
5. Make duplicate/forged client health messages impossible by design; test invalid input handling.
6. Write a Playwright browser test that uses **two different BrowserContexts**, not two local components pretending to be players. Each context acts on only one fighter. Assert both contexts receive the same match ID, canonical tick progression, HP change, and winner.
7. Test a third context getting a room-full error and one client disconnecting without crashing the server.
8. Record test commands/results. If an automated UI action cannot be reliably driven, make deterministic debug hooks available **only in development/test mode**, never trust them for match outcomes.

**STOP HERE FOR USER REVIEW** after M1 passes. Summarize what works, demonstrate locally, identify missing features, and explain how to reproduce the two-browser test. Do not proceed to sprite generation or scope expansion unless the user directs you.

### M2 — Full mechanics and stable rooms (when authorized)

Implement every input and state in PRD Section 5: crouch, jump punch/kick, slide kick, uppercut launch, dash, charged punch, `J-J-J`, `J-K-J`, stun, knockback, knockdown, guard break, cooldowns and input buffer. Add timer, best-of-three, result/rematch screens, pause-on-disconnect, seat-token reconnection and forfeit. Expand unit and E2E coverage before calling this done.

### M3 — PvE + human matchmaking (when authorized)

Add a one-difficulty rule-based bot with reasonable reaction delays, a public queue, cancellation, race-safe matching, and optional Fight AI Instead after the 15-second wait. PvE must reuse the server's combat and input pipeline and work without a generative AI service. Ensure lobby cleanup when players leave or switch to PvE.

### M4 — Asset integration and deployment documentation (when authorized)

Replace placeholders with original sprites produced outside this first development pass; stable feet/pivots and constant logical hitboxes. Integrate minimal hitsparks/audio and in-game help. Verify both PvP and PvE flows again. Document deployable Node WebSocket hosting and client URL configuration. **Do not claim real public internet testing without actually doing it.**

## 6. Required proof and test cases

Run and report the real commands for each applicable check.

**By M1:**
- `npm run typecheck` passes.
- `npm run test` passes with simulation and room tests.
- `npm run build` passes.
- `npm run test:e2e` passes with a two-context room match.
- Both players can move independently; attack once inside range, miss outside range, block, update HP and guard in both contexts, KO, reset.
- A third player is rejected and a disconnected socket does not crash the match server.
- Prove that server snapshots determine damage and HP, not client-generated values.

**By M2:**
- Test every move/state, illegal inputs, charge threshold, combo buffer, front/rear block, guard regeneration, guard break, launch/fall, knockdown, overlapping hits, double-KO, 60-second timeout and two-win outcome.
- Test disconnect/resume/forfeit and round synchronization.

**By M3:**
- AI behavior and cooldown fairness; FIFO queue, cancel, duplicate joins, timeout prompt, queue-to-bot transition, and one full PvE match.

Don't inflate test counts or claim a browser/internet test succeeded based on source inspection. Capture clear failed/passed output and explain omissions.

## 7. Efficiency and code quality guidance

- Keep balance/move definitions in shared data. Test against public game behaviors rather than fragile implementation details.
- Use typed discriminated unions for fighter states and message payloads where practical.
- Keep UI readable at desktop size and provide basic loading/error status; no elaborate art before M1.
- Clamp delta/timing, bound all positions and values, and avoid per-frame allocations in hot paths where reasonable.
- Rate-limit input bursts; never allow incoming input to directly request a hit event or modify damage.
- Prefer explicit error codes (e.g., `ROOM_FULL`, `ROOM_NOT_FOUND`, `MATCH_STARTED`, `INVALID_SEAT`, `INVALID_INPUT`) and short user-friendly messages.
- Scope all socket listeners/cleanup to the relevant lifecycle; clean up sockets, intervals, and rooms after exit.
- Use no production-only paid services or external credentials in the first pass.

## 8. How to report to the user

At the end of each milestone, give a concise report with:

1. **Implemented:** exact completed functionality, not plans.
2. **How to run:** verified commands and local URL(s).
3. **Proof:** unit/E2E tests and exact pass/fail counts, plus how the two-browser case was exercised.
4. **Known gaps/risks:** including anything not manually verified on separate devices or public internet.
5. **Files changed / commits:** short summary and local commit hashes if commits were made.
6. **Next milestone:** one sentence, no unrequested scope additions.

If a test or build fails, fix it before declaring a milestone complete. If blocked by environment/tool limits, disclose the blocker and deliver the strongest reproducible partial result.

## 9. First task to execute now

Read `PRD.md` and these rules. Inspect the repository. Implement **M0 and M1 only**. Begin with a very short technical plan, then write code and tests. Run local two-browser proof using Playwright isolated contexts. Do not ask for final sprite assets. Do not start M2/M3/M4 automatically. Present the verified M1 status with how to run and test it.
