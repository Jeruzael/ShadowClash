# SHADOW CLASH — Minimum Viable Product (MVP) PRD

**Version:** 1.0  
**Date:** 2026-10-29  
**Status:** Approved build brief / ready for local implementation  
**Product type:** Two-dimensional, browser-based, real-time fighting game  
**Working title:** Shadow Clash (renameable)

## 1. Executive summary

Build a lightweight fighting game with exactly **two playable characters**, **White Ninja** and **Black Ninja**, sharing the same moves and statistics. Two people can fight through separate browsers over the internet using a private room link or simple matchmaking. If no second human player is available, the first player can immediately choose to fight a rule-based AI. The experience is inspired by the *feel* of arcade fighting games, but all code, character designs, sound, and art must be original or properly licensed.

**Product priority, in order:**
1. Two real browser clients can play **one authoritative online match**.
2. Attacks, movement, health, round results, and blocking behave consistently.
3. A single player can fight the AI through the same combat rules.
4. Add the full requested moveset and replace placeholder rectangles with generated sprite art.

**Core principle:** Gameplay and networking before visual polish. A synchronized match between two colored rectangles is a meaningful milestone; two beautiful but unsynchronized ninjas are not.

## 2. Goals, assumptions, and non-goals

### 2.1 Goals (must-have in the completed MVP)

- A player can open a website in a desktop browser and start a match with no account or download.
- PvP supports **exactly two human players per match**, on different browser instances/devices.
- A player can create a private room and share a join link; a second player can join and play.
- A player can queue for a human opponent. If none is found after **15 seconds** (configurable), offer a clear **Fight AI Instead** button; never silently substitute a bot for a human.
- A player can choose **Fight AI** immediately from the home screen.
- Both ninjas can perform the movement, attacks, combos, blocks, and hit reactions in Section 5.
- One fixed arena, readable health/guard bars, round timer, and best-of-three match victory.
- Online state and outcomes are authoritative on the **Node.js server**. The browser does not decide official hits, damage, or winners.

### 2.2 Product assumptions

- Desktop keyboard is the initial supported input method; mobile and gamepad controls come later.
- Initial match size is one-versus-one. The server may host multiple isolated 1v1 rooms, subject to hosting capacity.
- Character assignment is automatic: first human in a private room gets White Ninja, second gets Black Ninja. In PvE, human is White Ninja and AI is Black Ninja.
- Both ninja characters have identical gameplay statistics in v1; visual differences only.
- A single lightweight Node.js server instance with in-memory room/session state is acceptable for MVP. Restarting the server ends live matches.
- No database, user login, or payment service is required.
- Development begins with clearly labeled placeholder shapes. Generated assets come after networking and mechanics pass tests.

### 2.3 Explicitly out of scope

Accounts, leaderboards, ranked mode, chat, spectating, tournaments, skins shop, complex character selection, weapons, story mode, multiple stages, mobile touch controls, sophisticated netcode/rollback, cross-server matchmaking, persistent player data, voice chat, microtransactions, and generative-model calls during gameplay.

## 3. Audience and primary user stories

- **Friend match:** As Player A, I click **Fight a Friend**, copy a room link, and share it. Player B opens the link. Both see the same fight and can control only their own ninja.
- **Find a player:** As a solo visitor, I click **Find Opponent**, enter a queue, and start when another player is available. If none joins promptly, I can switch to an AI match without restarting the website.
- **Fight AI:** As a solo player, I click **Fight AI** and start a responsive fight against the computer.
- **Fair fight:** As either player, my opponent cannot arbitrarily set health, position, damage, or the match winner using browser messages.
- **Understand a result:** When health reaches zero or the round clock expires, both players see the same round result; first to two round wins wins the match.

## 4. Game presentation and flow

### 4.1 Single fixed arena

- Internal logical presentation target: **1280 × 720** with responsive letterboxing/scaling on desktop.
- Side-view camera, ground plane, left/right arena boundaries, high-contrast silhouettes, and clear floor position.
- No scrolling camera or platforms in MVP. Fighters always face toward one another.
- White Ninja and Black Ninja must remain distinguishable even against a dark stage: use outlines, separate accent colors, and **P1/P2** labels. Placeholder art must meet the same clarity goal.

### 4.2 Home menu

1. **Fight a Friend** → create room → show room code and copyable invite link → waiting screen → opponent joins → countdown → match.
2. **Find Opponent** → matchmaking queue with Cancel option → opponent found → countdown → match; after 15 seconds offer **Fight AI Instead**.
3. **Fight AI** → immediately create PvE session with an AI opponent → countdown → match.

All three flows end in the same arena/round UI and a result screen with **Rematch** (where supported) and **Main Menu**. In PvP, a rematch requires both players to agree; otherwise return to lobby.

### 4.3 HUD

Display character labels, health (0–100), guard meter (0–100), round wins, authoritative countdown (60 seconds), network status for PvP, and round/match result. Show a compact keyboard-controls overlay before the first round and accessible from a Pause/Help overlay (in PvP, the overlay does not pause the other player's simulation).

## 5. Controls and combat specification

### 5.1 Keyboard bindings

| Key/input | Action | Notes |
|---|---|---|
| `A` / `D` | Move left / right | Horizontal screen directions, independent of facing |
| `W` | Jump | Grounded only; no double jump |
| `S` | Crouch | Grounded only; used for two special attacks |
| `J` | Light punch | Also the first/third button of combos |
| `K` | Kick | Also available while airborne |
| `L` (hold) | Block | Face incoming ground attacks; cannot attack while holding block |
| `Shift` | Short forward dash | Forward = toward opponent; bounded, cooldown-limited |
| `I` (hold then release) | Charged punch | Charge for at least 0.4 seconds to activate; cap charge at 1.2 seconds |
| `S + K` | Slide kick | Takes priority over normal kick |
| `S + J` | Upward launching punch (uppercut) | Takes priority over normal punch |
| `W`, then `J` in air | Jump punch | One air attack per jump |
| `W`, then `K` in air | Jump kick | One air attack per jump |
| `J → J → J` | Combo punch | Successive accepted hits/inputs in combo windows |
| `J → K → J` | Mixed combo | Ends with a more forceful finisher |

**Input rules:** All attack combinations are interpreted by the server from accepted, ordered inputs. Holding `J` does not spam punches. The simultaneous `S + J`/`S + K` rules override a standing punch/kick. Air attacks override grounded attacks. Charging `I` while stunned, knocked down, or blocking is not allowed. Releasing `I` too early cancels the charged attack harmlessly. Provide input buffering so reasonable fast sequences can trigger combos. Display the effective control mapping in-game.

### 5.2 Core fighting states

`idle`, `walk`, `crouch`, `jump`, `fall`, `dash`, `attack`, `block`, `hitstun`, `guard_break`, `launched`, `knockdown`, `knockout`, and `round_end`.

Important rules:

- Only allowed transitions can change state; knockouts and round-ending states override attacks.
- Every attack has startup, active, and recovery windows, plus a range/hitbox and a single-hit-per-target rule.
- No attacking while in hitstun, guard break, knockdown, or knockout.
- Block only works for attacks arriving from the facing/front side, when grounded and in an eligible blocking state. A successful block removes guard rather than health for the initial MVP; unblockable mechanics are excluded.
- If guard reaches zero, trigger **guard break**, temporarily preventing movement/attacks/blocking, then restore a small guard amount. Guard regenerates only after not blocking for a short delay.
- A normal hit causes brief hitstun; a heavy hit adds knockback or knockdown; an uppercut can launch a character airborne. Launched fighters fall to the ground and recover.
- A fighter cannot be hit repeatedly by one attack's same active window. Limit juggles/combos to avoid infinite loops.
- Ground boundaries and fighter collision keep characters inside the arena. During a jump, standard gravity and landing apply.
- Simultaneous valid hits and potential double-KO must be resolved consistently on the server. A double-KO is a draw round, not two simultaneous victories.

### 5.3 Initial balance parameters (tunable; not promises of final balance)

| Setting | Starting value |
|---|---:|
| Health | 100 |
| Guard meter | 100 |
| Round duration | 60 seconds |
| Round wins required | 2 |
| Guard-break duration | 0.8 seconds |
| Guard regeneration delay | 1.0 second after last block |
| Guard regeneration | 12 points per second |
| Forward dash duration | 0.15 seconds |
| Dash cooldown | 0.35 seconds |
| Maximum combo chain | 3 listed attacks (v1) |

| Move | Initial damage | Expected reaction |
|---|---:|---|
| Light punch `J` | 5 | Brief hitstun |
| Kick `K` | 8 | Hitstun and slight knockback |
| Slide kick `S+K` | 9 | Knockback; punishable recovery |
| Uppercut `S+J` | 12 | Air launch |
| Jump punch | 6 | Aerial hitstun |
| Jump kick | 10 | Aerial hitstun / knockback |
| Charged punch | 16 | Strong knockback or knockdown; high guard damage |
| `J → J → J` combo | Individual punch hits | Third hit increases knockback |
| `J → K → J` combo | Individual move hits | Third hit is a finisher |

Move durations, velocity, knockback, cancel windows, combo buffers, guard costs, and hitbox extents belong in a **single versioned balance configuration** in the shared simulation package, rather than hard-coded throughout the client and server. These are proposed values; validate and adjust during playtesting.

## 6. Match, matchmaking, and disconnect rules

### 6.1 Private room PvP

- Generate an unpredictable six-character room code (or longer if needed); share a `?room=...` invite link.
- Server accepts no more than two players in a match; a third joiner receives a clear **Room Full** response.
- A join link identifies a room, **not** the right to impersonate a seated player. Give each human seat a separate unguessable reconnect token, scoped to that room and stored in per-tab session storage.
- Show Waiting for Opponent, countdown, active round, result, and rematch states.
- Reject duplicate room starts, duplicate seat claims, and forged action messages.

### 6.2 Public queue

- A simple first-in-first-out queue pairs two unpaired players; each leaves the queue on successful match creation.
- Never match a user with their own browser/session.
- After 15 seconds, show an optional **Fight AI Instead** action while remaining in queue until the user chooses. If they choose AI, atomically leave the queue before starting PvE. Also offer Cancel.
- Queue behavior and races are tested with multiple simultaneous connections.

### 6.3 Disconnect and reconnection

- If a PvP participant disconnects mid-match, pause authoritative simulation for up to **15 seconds**, visibly inform the remaining player, and permit the same seat token to resume.
- If the player returns within the grace period, send a fresh authoritative state snapshot and resume countdown/simulation.
- If reconnection fails, end the match with a forfeit result for the remaining player. No AI silently takes over a PvP seat.
- If the server restarts, live matches are lost; present a friendly recovery message and return clients to the menu.
- Treat Socket.IO connection-state recovery as a convenience, **not** proof that game state is correct; always resynchronize canonical state.

### 6.4 Round rules

- On KO: freeze actionable inputs, display result, award one round win, reset both fighters after a short countdown.
- On timer expiry: the fighter with more remaining health wins; equal health means draw and no point.
- On double-KO: draw and no point.
- First to **two round wins** wins the match. Display shared result to both clients.
- After match conclusion, cleanup room/session resources within a bounded time; preserve the result long enough for the result screen and rematch decision.

## 7. Technical architecture

### 7.1 Preferred stack

- **Language:** TypeScript, strict mode.
- **Client:** Vite + Phaser for rendering/animation/input/HUD (target current stable Phaser 4.x; consult API docs for installed version; pin dependencies).
- **Backend:** Node.js (maintained LTS) + Socket.IO 4.x, with an HTTP health endpoint.
- **Shared:** A platform-neutral TypeScript game simulation/state machine and network protocol types. **Never use Phaser physics to decide authoritative server results.**
- **Testing:** Vitest for simulation/server unit tests; Playwright for two-isolated-browser end-to-end scenarios.
- **Package manager:** npm workspaces, with one committed lockfile.
- **Persistence:** none. Keep live rooms, queue, and reconnect metadata in server memory for MVP.

### 7.2 Networking model

- **Server-authoritative**, fixed **60 Hz simulation tick**; send **~20 Hz state snapshots** (adjust after profiling). Browser aims for **60 FPS rendering**, interpolating remote positions between snapshots as needed.
- Clients transmit only validated button/axis **input intents** with monotonically increasing input sequence numbers and a compact held/pressed state. They **must not** submit trusted position, damage, health, collision outcome, or winner values.
- The server assigns seat ownership, bounds inputs/rates, discards stale/duplicate messages, runs collision and damage rules, records round results, then broadcasts snapshots and important events to that specific match room.
- Apply latency/rate limits sensibly. Keep authoritative correctness ahead of premature prediction or rollback. Basic responsive local feedback is desirable, but any client prediction must reconcile to server truth.
- Use Socket.IO rooms for network broadcast; maintain a separate typed, authoritative `Match` object and seat credentials in application state.
- Maintain canonical server ticks, not client wall-clock timing, for attack windows and countdowns.
- Document fixed input semantics and protocol versions in the shared package.

### 7.3 Suggested repository structure

```text
shadow-clash/
  PRD.md
  AGENTS.md
  README.md
  package.json
  package-lock.json
  .env.example
  apps/
    client/
      src/
        main.ts
        game/scenes/           # MenuScene, FightScene, ResultScene
        network/               # Socket.IO client, snapshot rendering
        ui/
    server/
      src/
        index.ts               # Node HTTP / Socket.IO startup
        MatchManager.ts        # Rooms, queue, seats, reconnect
        Match.ts               # Per-match simulation loop
        AIController.ts        # Rule-based AI uses legal inputs
  packages/
    shared/
      src/
        protocol.ts            # Network event/payload types
        gameState.ts           # Pure simulation / state transitions
        moves.ts               # Data-driven moves and balance
  tests/
    e2e/                      # Two-browser PvP scenarios
```

This is an organizational suggestion, not permission to introduce extra architectural layers. Prefer the fewest files that keep input, simulation, and rendering cleanly separated.

### 7.4 Reliability and security expectations

- Validate and cap all incoming input payloads, room code lengths, and event rates. Never trust client-reported damage or winners.
- Generate room/reconnect tokens using a cryptographically secure server-side method; no secrets or API keys in client bundles.
- Restrict allowed origin(s) in production, configure environment variables, and avoid logging reconnect credentials.
- Use HTTPS/WSS in deployment and a host that supports a long-running Node process and WebSocket connections. **A static-only hosting service cannot host the live match server by itself.**
- Add a `/health` route, reasonable idle-room expiry, queue cleanup, bounded reconnect windows, structured error codes/messages, and graceful shutdown behavior.
- Do not claim production-grade anti-cheat. This is basic authoritative input validation appropriate for an early prototype.

## 8. Art and audio pipeline (after core gameplay works)

- First milestone uses two simple high-contrast rectangles/shapes labeled White Ninja and Black Ninja.
- Create one **original** consistent 2D side-view ninja design with a reference sheet; derive two colorways and check silhouette clarity. Avoid copyrighted character depictions and unlicensed assets.
- Generate discrete poses/frames for idle, walk, jump, crouch, dash, punch, kick, slide, uppercut, charge, block, hit, guard-break, launch, knockdown, and KO. Not every state needs a large animation initially.
- Keep fixed pivot/feet position and frame canvas dimensions. Clean up and export transparent PNG frames, then pack into sprite sheets with frame metadata. Do not rely on a generated video as the gameplay hitbox source.
- Maintain stable gameplay hitbox data independent of art/sprite sizes, so visual replacement cannot change damage logic.
- Add original or appropriately licensed sound effects, toggled sound option, simple hitsparks, and screen shake only after playability is proven.
- Store asset provenance/license notes in `docs/ASSETS.md` when final assets are added.

## 9. Delivery milestones and acceptance criteria

### M0 — Repository and local single-match foundation

**Build:** npm workspace, strict TypeScript, Phaser scene with two placeholder fighters, a pure shared simulation with gravity/boundaries/basic hitbox tests, Node server, client-server connection, reproducible local development commands.

**Pass:** clean install; `npm run dev` launches both services; client renders both fighters; tests/build/typecheck pass. This is scaffolding, **not online completion**.

### M1 — REAL ONLINE PvP vertical slice (highest priority; stop for review here)

**Build:** two distinct browser contexts join the same private room; first White/second Black; both can move, perform one basic attack, block, reduce opponent health, and finish/reset rounds. Server validates all hits and room membership. Show connection and room status.

**Pass checklist:**
- Two isolated browser contexts simultaneously connect to the same authoritative match.
- Inputs from Browser A change only A's fighter; inputs from B change only B's.
- Moving either fighter is reflected on both screens.
- Punching from within range reduces the opponent's health **once** on both screens; missing does zero damage.
- Holding block correctly prevents health loss on a valid blocked punch and changes guard instead.
- Health cannot be changed by a client-sent arbitrary health/damage value.
- KO and round reset appear identically on both clients; room capacity max two is enforced.
- Disconnect is visible and handled safely (grace-period behavior can be finalized in M2).
- Automated unit tests, typecheck/build, and a Playwright scenario using **two independent contexts** pass.

**Important:** Two fighters controlled from one keyboard in one browser is **not** proof of multiplayer. Neither is a screenshot of two independent, unsynchronized game instances.

### M2 — Full combat and reliable room flow

**Build:** remaining moves, two combo chains, air attacks, dash, slide, charge, uppercut/launch, knockback, hitstun, guard break, knockdown, 60-second timer, best-of-three match, invite links, robust disconnect/reconnect, win and rematch UX.

**Pass:** each requested move can be triggered reliably; invalid transitions are prevented; hit registry avoids repeated damage; combo/guard/launch tests pass; PvP remains synchronized across rematch and reconnect.

### M3 — Solo PvE and matchmaking

**Build:** deterministic bounded-state AI (`approach`, `defend`, `attack`, `recover`), one normal difficulty, Fight AI menu, public queue, 15-second optional bot fallback, clean cancel/leave, clear win/lose flow.

**Pass:** AI can win or lose legally using the same move/hit system and never changes health directly. Queue pairs two humans; leaving and AI fallback do not create duplicate seats or matches. No game-model API calls or ongoing AI subscription costs.

### M4 — Original ninja sprites, presentation, and launch checklist

**Build:** replace placeholders with original white/black ninja frames, readable HUD, simple hit effects/audio, keyboard help, asset credits/license notes, production build/deployment README.

**Pass:** game logic tests remain green after sprite replacement; at least one complete PvP match and one PvE match have been tested in a deployed or deploy-equivalent configuration. Confirm actual public internet testing **only if performed**.

## 10. Test strategy

### Unit tests (shared simulation)

- Movement bounds, gravity/landing, dash cooldown, facing, one air attack per jump.
- Hitbox in range vs out of range; front guard vs rear hit; one hit per attack target.
- Health never below zero or above initial maximum; no NaN/undefined coordinates.
- Guard drains/regenerates, guard break duration and recovery.
- Attacks blocked while stunned/KO; launch to gravity to landing; finite combo maximum.
- Simultaneous hits, draws, timeout decisions, first-to-two, reset of buffs/timers between rounds.
- Ordering/duplicate/out-of-range input and invalid state payloads rejected.

### Integration tests (server)

- Create/join/full room, seat assignment, safe room code, other room isolation, input ownership.
- Queue match/cancel race, reconnect token valid/invalid, paused match recovery and forfeit timeout.
- Two clients cannot both claim one player seat; joined/closed rooms are cleaned up.
- AI uses the same legal input processing and cannot bypass cooldowns.

### Browser E2E (Playwright)

- Open two isolated browser contexts; create room in first, join link in second; see both names and match start.
- Attack and verify both see the **same authoritative HP**, round winner, and reset.
- Verify third browser cannot join a two-person room.
- Disconnect/reconnect one browser and verify correct pause/resume/forfeit.
- Run at least one full AI match and one queue-to-AI fallback path after M3.

### Manual verification

- Two actual browsers/devices on a network. Confirm keyboard focus, playability, hit feedback, visibility, and fairness.
- For an **online** release claim, complete an actual cross-internet test with deployed WebSocket-capable server; local Playwright contexts alone cannot prove internet deployment.
- Check browser console/server logs for uncaught errors; record evidence and remaining limitations honestly.

## 11. Definition of done (MVP release)

All core goals in Section 2.1 work. At least one real two-human PvP match and one PvE match complete from menu to result using the same combat engine. Server-authoritative damage/wins are verified. No known blocking gameplay defects or uncaught errors. `README.md` documents install/run/build/test/deploy instructions, environment variables, verified tests, and known limitations. Generated art is clearly original/licensed, and missing functionality is not presented as implemented.

## 12. Risks and decisions

| Risk | Mitigation / decision |
|---|---|
| Unstable combat across network | Fixed server tick and authoritative hit resolution; isolate rules from Phaser visuals |
| Lag creates delayed input | Start with modest 1v1 rooms, interpolation, instrument RTT; consider prediction/rollback only after M1 is correct |
| Generated sprites inconsistent | Build placeholders first; reference sheet, fixed pivots, limited poses, manual asset cleanup |
| AI feels unfair | Rule-based reactions, shared cooldowns/hitboxes, bounded reaction delay; no omniscient bypass |
| Scope grows uncontrollably | Stop at M1 review; finish M2/M3 before extra characters, menus, cosmetics, accounts |
| Free host sleeps/drops WebSockets | Verify hosting support and limitations before selecting deployment provider |
| Room-link griefing / impersonation | Separate invite code and seat reconnect credential; validate capacity and inputs server-side |

## 13. Reference documentation

These are implementation references, not dependencies beyond those selected above. Check the installed versions when coding.

- Google Antigravity getting started: https://antigravity.google/docs/getting-started/
- Antigravity rules (`AGENTS.md`): https://antigravity.google/docs/rules/
- Phaser documentation: https://docs.phaser.io/
- Phaser release archive: https://phaser.io/download/archive
- Socket.IO rooms: https://socket.io/docs/v4/rooms/
- Socket.IO delivery guarantees: https://socket.io/docs/v4/delivery-guarantees/
- Playwright isolated browser contexts: https://playwright.dev/docs/browser-contexts
