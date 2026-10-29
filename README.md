# Shadow Clash — M0/M1

A local, server-authoritative browser 1v1 prototype. White Ninja and Black Ninja use original Phaser placeholder shapes. No accounts, assets, AI service or database.

## Requirements and local play

Use a maintained Node.js LTS (tested with Node 22.23.3 and npm 10.9.9).

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Click **Fight a Friend**, then open the invite link in a separate browser/profile or private window and click **Join room**. First player is P1/White; second is P2/Black. Click the arena before playing. A third player receives Room Full.

Both services bind to loopback: client `5173`, server `3001`; `/health` is at **http://127.0.0.1:3001/health**. Stop with Ctrl+C. Copy `.env.example` to `.env` for configuration; no credentials are required. The client proxies Socket.IO to `SERVER_PORT`. An explicit `VITE_SERVER_URL` is a build-time override. `ALLOWED_ORIGIN` lists permitted browser origins, separated by commas. Vite loads root `.env`; Node scripts load it explicitly.

| Controls (each player uses their own keyboard) | Action |
| --- | --- |
| A / D | Move left / right |
| W | Jump (release to jump again) |
| J | Ground punch (release between attacks) |
| L held | Ground block |

Punches cause 5 damage after startup, at most once per attack. A valid front block absorbs health damage and spends 18 guard. With no guard, attacks damage health. In M1 guard replenishes on round reset only. Air attacks are deferred. HP reaches zero → shared round result → automatic reset/countdown. Round wins are recorded, but a best-of-three match and timer belong to M2. Blur or hidden pages release all controls; the server expires missing input heartbeats after half a second.

## Verification

```powershell
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts isolated local test services on `5174` and `3002`; keep those ports free. It creates **two independent BrowserContexts** plus a third context for capacity rejection. The test uses real keyboard inputs and real sockets, verifies both players' movement, a miss, block/guard, one-hit and held-J behavior, forged events, identical canonical snapshots/results, 20 legal punches to KO, round reset, and safe disconnect. It checks browser errors and captures screenshots in `test-results/`. There are no server-side test shortcuts for positions, damage, health or winners. A client socket/history observer is included only in Vite `test` mode and removed from production builds.

Unit tests exercise the headless simulation; integration tests use actual TCP Socket.IO clients. Exact final verification results are recorded in `docs/VERIFICATION.md` after execution.

To run the built output locally, use two terminals after `npm run build`:

```powershell
npm start
```

```powershell
npm run preview
```

The preview is at **http://127.0.0.1:5173** and proxies to the Node server, just like development. Static files alone cannot run the authoritative game server.

## Architecture and protocol v1

- `packages/shared/src/gameState.ts`: fixed 60 Hz pure TypeScript movement, gravity, collision, facing, punch startup/active/recovery, block, hitstun, simultaneous hits, KO and round reset. `balance.ts` is the single versioned source of gameplay constants.
- `apps/server/src/server.ts`: secure room allocation, socket-bound seats, exact payload validation, bounded rates/resources, input expiry and approximately 20 Hz room-scoped canonical snapshots. A single monotonic scheduler advances all rooms, caps catch-up work after stalls, and never uses client time or animation events for combat.
- `apps/client/src/main.ts`: Phaser rendering and keyboard capture; HTML lobby/HUD renders the same canonical snapshots. Visual smoothing has no effect on gameplay.

`room:create(ack)` and `room:join({code}, ack)` allocate a seat. Replies are `{ok:true,value}` or `{ok:false,error:{code,message}}`. `input({seq,buttons:{left,right,jump,punch,block}}, ack?)` carries five booleans and a strictly increasing 1–2147483647 sequence ID. Press edges are derived on the server and latched between ticks. Extra fields, stale IDs, malformed payloads, input bursts, or unseated inputs are rejected. The sender never selects which fighter to control. No health/damage/winner events are registered. Socket.IO messages are capped at 1 KiB. `snapshot` contains `protocol`, `roomCode`, `matchId`, canonical `tick`, both fighters and the official round result. `room:leave(ack)` releases membership.

Room codes are cryptographically random eight-character identifiers. Each seat receives a separate 256-bit token stored in that tab's session storage; M1 never accepts it to replace a seat. Token-based reconnection is deferred to M2. Disconnect/leave ends the fight for the remaining player. Closed rooms reject replacement players and expire within 30 seconds; empty rooms are reclaimed immediately. Rooms without accepted input expire after 60 seconds, and every room has a one-hour maximum lifetime. The server caps rooms at 128 and connections at 512.

## Scope and limitations

M0/M1 only: no full moveset, crouch, dash, charged moves, combos, guard regeneration/break, countdown timer, best-of-three match, reconnection grace, rematch agreement, PvE, matchmaking, final sprites, audio or deployment. Do not treat this as the completed PRD MVP.

The automated online proof is local, using separate browser contexts and a real authoritative server. Separate physical devices and public cross-internet play have not been verified. Loopback defaults intentionally do not expose ports to the network. Network latency produces visible input delay; there is no prediction or rollback. This prototype has basic authoritative validation, not production-grade anti-cheat. Server restarts lose live rooms. Future hosting needs a long-running Node/WebSocket process and HTTPS/WSS, in addition to client files; nothing has been deployed.

Two nonblocking cleanup issues remain: closed rooms can repeat their final snapshots until the 30-second expiry, and leaving a room retains its prior HUD/pose until another room snapshot arrives. Details and executed verification are in [docs/VERIFICATION.md](docs/VERIFICATION.md).
