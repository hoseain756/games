# Task 2-a — Game Service (socket.io mini-service) — Work Record

## Status: DONE, service running and verified

## What was built

Standalone Bun + socket.io backend service for the Arabic party game
("لعبة الأسئلة") at `/home/z/my-project/mini-services/game-service/`:

- `package.json` — name `game-service`, dev script `bun --hot index.ts`, dependency `socket.io ^4.8.1` (installed 4.8.4). Independent bun project with its own `node_modules` + `bun.lock`.
- `index.ts` — full room/game management server, port **3003** hardcoded, socket.io `path: '/'` (required by Caddy gateway), CORS `*`, pingTimeout 60000, pingInterval 25000.
- `service.log` — runtime log (nohup output).

Nothing outside `mini-services/game-service/` was touched (plus this agent-ctx record).

## Runtime

- **PID: 1795** (`bun --hot index.ts`), own session via `setsid -f` so it survives tool invocations.
- Listening check: `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3003/?EIO=4&transport=polling"` → **200**.
- End-to-end smoke test (ephemeral engine.io polling via curl, no persistent test script): handshake → ns connect → `host:create` with 3 Arabic questions → received `room:created {"code":"EQVA","state":"lobby","questions":[...],"opts":{...}}`. Log confirms room creation. Test socket auto-cleans (host disconnect with no players deletes the room).

## Implementation summary (per spec)

- Rooms Map + `socket.id -> {code, role, playerId}` map + per-room `playerId -> socketId` map (always deliver private question to the CURRENT socket of the turn player).
- Room code: 4 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, unique among active rooms.
- Validation: name trimmed 1..30, selfie ≤ 300000 chars ('' allowed), questions cleaned to 1..500 strings of 1..200 trimmed chars, max 20 players/room.
- `pickQuestion` replicated exactly (no-repeat bag with adjacent-repeat guard + refill toast `انتهت الأسئلة، نعيد خلطها` when round>1 or idx>0; random mode with 25-try same-question guard).
- Host disconnect: room deleted immediately if no connected players, else `host:offline` + 90s delete timer (cancelled by `host:reconnect`).
- Player disconnect: `connected=false` (kept in list), socket maps cleaned (guarded against stale-socket overwriting a newer reconnection), `lobby:update` to room.
- Cleanup interval 60s: rooms with `lastActivity` older than 10 min AND disconnected host are deleted. SIGTERM/SIGINT graceful shutdown. Every handler wrapped: unexpected errors emit `room:error` `حدث خطأ غير متوقع` and are console-errored; `uncaughtException`/`unhandledRejection` logged without killing the process.

## Frontend contract (events)

Client -> Server (payloads):
1. `host:create` `{ questions: string[], opts: { norepeat, shuffle } }`
2. `host:reconnect` `{ code }`
3. `player:join` `{ code, playerId, name, selfie }`
4. `player:leave` `{}`
5. `host:start` `{}`
6. `host:next` `{}`
7. `host:reroll` `{}`
8. `host:peek` `{}`
9. `host:hide` `{}`
10. `host:end` `{}`
11. `host:close` `{}`
(+ socket.io built-in `disconnect`)

Server -> Client:
1. `room:created` `{ code, state, questions, opts }` (to host socket)
2. `room:error` `{ message }` (to the offending socket)
3. `lobby:update` `{ players: PublicPlayer[], state }` (to room)
4. `player:joined-ok` `{ name, state }` (to joining socket)
5. `player:question` `{ text }` (private, to current turn player's socket)
6. `game:turn` `{ round, turnNo, total, currentPlayer: PublicPlayer|null }` (to room)
7. `host:question` `{ text: string|null }` (to host; null on hide)
8. `toast` `{ message }` (to room, on no-repeat bag refill)
9. `game:ended` `{}` (to room)
10. `room:closed` `{}` (to room)
11. `host:offline` `{}` (to room when host drops but players remain)

`PublicPlayer = { id, name, selfie, connected }`, `id` = client-generated persistent uuid (never the socket id).

Error messages emitted (Arabic): `أضف سؤالاً واحداً على الأقل`, `انتهت صلاحية الغرفة`, `الغرفة غير موجودة، تأكد من الرمز`, `اللعبة بدأت بالفعل`, `الاسم مستخدم، اختر اسماً آخر`, `الغرفة ممتلئة`, `تحتاج لاعبين اثنين على الأقل للبدء`, `حدث خطأ غير متوقع`, plus defensive `الاسم غير صالح` / `حجم الصورة كبير جداً` / `بيانات غير صالحة` / `غير مصرح` for malformed payloads.

## Notes for frontend agent

- Frontend must connect with `io('/?XTransformPort=3003')` (path '/', relative URL only).
- Players keep a stable `playerId` (uuid) in localStorage and reuse it for reconnect; during `playing` state only known playerIds can rejoin.
- Host should call `host:reconnect` on page reload to recover the room within the 90s grace window.
- Minor additive behaviors beyond the literal spec (all consistent with it): `lobby:update` is also emitted to the room when a player rejoins while playing (so the host sees connected=true), and an explicit `player:leave` during a game removes the player from `order` with safe `idx` adjustment. No spec behavior was changed or omitted.

## Restart procedure (if the service dies)

```bash
cd /home/z/my-project/mini-services/game-service
setsid -f nohup bun run dev > service.log 2>&1 < /dev/null &
```
NOTE: plain `nohup ... &` (and even `setsid` without `-f`) gets killed between tool invocations in this sandbox — `setsid -f` is required.
