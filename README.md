# Shadow Clash — M0/M1 + M1.1 stabilization

A local, server-authoritative browser 1v1 prototype. White Ninja and Black Ninja use original Phaser placeholder shapes. No accounts, assets, AI service or database.

## Requirements and local play

Use a maintained Node.js LTS (tested with Node 22.23.3 and npm 10.9.9).

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Click **Fight a Friend**, then open the invite link in a separate browser/profile or private window and click **Join room**. First player is P1/White; second is P2/Black. Click the arena before playing. A third player receives Room Full.

By default both services bind to loopback: client `5173`, server `3001`; `/health` is at **http://127.0.0.1:3001/health**. Stop with Ctrl+C. Copy `.env.example` to `.env` for configuration; no credentials are required. The client proxies Socket.IO to `SERVER_PORT` on the host computer. Keep `VITE_SERVER_URL` empty to use that same-origin proxy; an explicit value is a build-time override. `CLIENT_PORT` defaults to `5173`. `ALLOWED_ORIGIN` lists exact permitted browser origins, separated by commas. Vite loads root `.env`; Node scripts load it explicitly.

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

Unit tests exercise the headless simulation; integration tests use actual TCP Socket.IO clients. M0/M1 results are recorded in `docs/VERIFICATION.md`; stabilization results are in [docs/M1.1-VERIFICATION.md](docs/M1.1-VERIFICATION.md). The expanded browser suite also checks complete HUD/canvas reset, all six connection states, refresh, old-room rejection, transport loss/recovery, new-room reuse, and the HTTP clipboard fallback.

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

Room codes are cryptographically random eight-character identifiers. Each seat receives a separate 256-bit token stored in that tab's session storage; M1 never accepts it to replace a seat. Token-based reconnection is deferred to M2. Disconnect/leave/expiry sends one final closure notification and immediately removes the room, both socket memberships, and all seat/input resources. Closed codes cannot be reused to resume the fight. The one shared simulation scheduler starts when the first room is created and stops when the last room is removed; `/health` reports `rooms` and `simulationRunning`. Rooms without accepted input expire after 60 seconds, and every room has a one-hour maximum lifetime. The server caps rooms at 128 and connections at 512.

Returning to the lobby resets health, guard/progress bars, positions and poses, score/result, match ID, tick, round, invite and seat receipt. New rooms always begin with fresh state. The header distinguishes **Connected to server**, **Waiting for opponent**, **Opponent connected** (countdown), **Match in progress**, **Opponent disconnected**, and **Connection lost**. Refresh/disconnect closes the old M1 fight; after reconnecting, create or join a new room. Transport recovery does not resume a seat.

## Two devices on trusted Wi-Fi

Use two desktop/laptop browsers with keyboards on the same trusted local network. LAN hosting is opt-in; no firewall, router, tunnel or public-hosting changes are made by these scripts.

1. On the host computer, run `ipconfig` and find the Wi-Fi adapter's **IPv4 Address**. It should be a private address such as `192.168.1.6`. VPN/Tailscale addresses and the router/default gateway are not the host Wi-Fi address.
2. Stop existing dev/preview services. If `.env` does not exist, copy `.env.example` to `.env`. Set these root `.env` values, replacing the example with the host's actual IP:

   ```dotenv
   LAN_HOST=192.168.1.6
   CLIENT_PORT=5173
   SERVER_PORT=3001
   VITE_SERVER_URL=
   ```

   Keep the sample `ALLOWED_ORIGIN` or your exact origin list. The selected LAN origin is added automatically. `LAN_HOST` accepts one RFC1918 IPv4 address (10.x, 172.16–31.x, or 192.168.x) and rejects wildcard/public addresses. The address must belong to this host. The client binds to that specific interface; Node remains on `127.0.0.1:3001`.
3. Run `npm run dev`. On **both devices**, open `http://192.168.1.6:5173` using the host's IP. In LAN mode use this address on the host too; the client is bound to the selected Wi-Fi address. Click Fight a Friend on one device and open its generated invite on the other. Invites and Socket.IO use the page's LAN origin, so the second device never needs its own localhost server.
4. If Copy link is unavailable over HTTP, the app selects the full invite for manual copy. The fallback is expected on an HTTP LAN page; no certificate is required for this prototype test.
5. If the second device cannot connect, check the host IPv4/port, same Wi-Fi/subnet, VPN routing and router guest/client isolation. Inspect Windows Firewall's prompt/rules: allow the intended application/port only on a trusted **Private** network, restricted to the local subnet. Do not allow Public-network access, disable the firewall, bind `0.0.0.0`, or configure router port forwarding/tunnels. This repository does not change those settings. If Windows labels your trusted Wi-Fi Public, review the network profile yourself before deciding whether to permit LAN access.
6. To stop LAN hosting, press Ctrl+C, clear `LAN_HOST` in `.env`, and restart. The default client returns to `http://127.0.0.1:5173`.

For built local output, `npm run build`, then `npm start` and `npm run preview` in two terminals use the same `.env` LAN settings and proxy. This remains local testing, not deployment.

Manual acceptance checklist: record browsers/devices and host IP; verify both connection statuses, private-room join, independent A/D movement, an out-of-range miss, J hit/HP on both screens, L block/guard on both, KO and round reset. Then leave, create/join a new room and confirm fresh HUD/positions. Refresh/close one browser; confirm the peer gets Opponent disconnected, the old code is rejected, and host `/health` returns zero rooms with `simulationRunning:false` after all rooms close. Disconnect/reconnect the host's client connection and confirm Connection lost → Connected to server with no old seat restored. Record observed results; preparation or local browser-context tests alone are not a completed physical-device test.

## Scope and limitations

M0/M1 only: no full moveset, crouch, dash, charged moves, combos, guard regeneration/break, countdown timer, best-of-three match, reconnection grace, rematch agreement, PvE, matchmaking, final sprites, audio or deployment. Do not treat this as the completed PRD MVP.

The automated online proof is local, using separate browser contexts and a real authoritative server. Separate physical devices and public cross-internet play have not been verified. Loopback defaults keep access local; LAN hosting requires explicit private-IP configuration. Network latency produces visible input delay; there is no prediction or rollback. This prototype has basic authoritative validation, not production-grade anti-cheat. Server restarts lose live rooms. Future hosting needs a long-running Node/WebSocket process and HTTPS/WSS, in addition to client files; nothing has been deployed.

The two M1 cleanup issues recorded in the historical verification report are addressed by M1.1. See [M1.1 verification](docs/M1.1-VERIFICATION.md) for executed results and remaining limits.
