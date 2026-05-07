# Faceless — Agent Guide

Context for coding agents (Codex, Claude, etc.) working in this repo. Optimized for "what do I need to know before I touch code?"

## What this is

Self-hosted, friends-only Discord alternative. Three things in one app:

- **Text chat** — servers → channels → messages, plus 1:1 / group DMs.
- **Voice chat** — channel-based, low-latency, via LiveKit SFU running in Docker.
- **Music bot ("Melody")** — joins voice channels and streams audio from URLs (yt-dlp + ffmpeg → PCM → LiveKit).

Designed for LAN use among trusted friends. No phone/email signup — just username + password. Invite-only joins.

## Repo layout

pnpm workspace monorepo. Three packages under `packages/`:

| Package | Role |
|---|---|
| [`@faceless/shared`](packages/shared) | TypeScript types and the WebSocket event contract. Built first — both client and server depend on it. |
| [`@faceless/server`](packages/server) | Express HTTP API + WebSocket handler + SQLite. Owns LiveKit token minting and the music bot. |
| [`@faceless/client`](packages/client) | Electron desktop app. Renderer is React 18 + Tailwind + Zustand, bundled by `electron-vite`. |

Top-level config:
- [`package.json`](package.json) — root scripts, pnpm `onlyBuiltDependencies` allowlist (argon2, better-sqlite3, electron, esbuild — these have native bindings).
- [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — workspace globs.
- [`tsconfig.base.json`](tsconfig.base.json) — strict, ES2022, ESM, `moduleResolution: bundler`.
- [`docker-compose.yml`](docker-compose.yml) + [`livekit.yaml`](livekit.yaml) — LiveKit dev server (ports 7880/7881/7882).
- [`.github/workflows/release.yml`](.github/workflows/release.yml) — version-bumped merges to `main` auto-build Windows portable + Linux AppImage and publish a GitHub release.

## Tech stack

- **Runtime:** Node.js ≥ 20, pnpm ≥ 8.
- **Server:** Express 4, `ws` (WebSocket), `better-sqlite3` (synchronous, WAL mode), `argon2` for password hashing, `nanoid` for IDs, `multer` for uploads.
- **Voice:** LiveKit — `livekit-server-sdk` (token minting) on the server, `livekit-client` in the renderer. Music bot uses `@livekit/rtc-node` to publish audio as a fake participant.
- **Music ingestion:** `yt-dlp-exec` resolves stream URLs, `ffmpeg` (system binary, must be on PATH) decodes to PCM. See [`packages/server/src/music/audio-pipeline.ts`](packages/server/src/music/audio-pipeline.ts).
- **Client:** Electron 30, `electron-vite` 2, React 18, Tailwind 3, Zustand 4. Renderer uses ESM imports with explicit `.js` extensions (because of bundler `moduleResolution`).
- **GIFs:** Klipy API proxied through the server (see [`packages/server/src/routes/gifs.ts`](packages/server/src/routes/gifs.ts)). Optional — set `KLIPY_API_KEY` to enable.

## Dev workflow

From repo root:

```bash
pnpm install
docker compose up -d        # start LiveKit (required for voice)
pnpm run build:shared       # build types — required before first server/client run
pnpm run dev:server         # tsx watch on packages/server/src/index.ts (port 3000)
pnpm run dev:client         # electron-vite dev (renderer on 5173, Electron loads it)
```

Other scripts (root [`package.json`](package.json)):
- `pnpm run build` — builds shared → server → client in order.
- `pnpm run db:migrate` — runs migrations (note: migrations also auto-run on server start, see below).

**Important:** `@faceless/shared` is consumed as a built package (`workspace:*` → `dist/`). After editing types in `packages/shared/src/`, run `pnpm run build:shared` (or `pnpm --filter @faceless/shared dev` for watch mode) or the consumers will see stale types.

## Configuration

Server reads from `packages/server/.env` (see [`.env.example`](packages/server/.env.example)):

| Var | Default | Notes |
|---|---|---|
| `PORT` | `3000` | API + WebSocket port. |
| `HOST` | `0.0.0.0` | Bind address. |
| `DB_PATH` | `./data/faceless.db` | SQLite file (created on first run). |
| `LIVEKIT_URL` | _(derived from request host)_ | Voice WebSocket URL handed to clients. If empty, server uses `ws://<request-hostname>:7880` so LAN clients get a routable address. |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | `devkey` / `devsecret...` | Must match `livekit.yaml` keys. |
| `LIVEKIT_PORT` | `7880` | Used when deriving the URL. |
| `KLIPY_API_KEY` | _(unset)_ | Optional, enables GIF picker. |

Client reads the server address from a UI field on the login screen ([`login-screen.tsx`](packages/client/src/components/auth/login-screen.tsx)) and stores it in [`stores/connection.ts`](packages/client/src/stores/connection.ts). Default is `localhost:3000`.

## Architecture notes

### HTTP + WebSocket boundary

- Express handles auth, CRUD, uploads, voice token issuance — see [`packages/server/src/index.ts`](packages/server/src/index.ts) for the route map.
- WebSocket (`/ws`) handles realtime: chat messages, typing, presence, voice presence, music commands. Auth is via a `?token=` query param checked against the sessions table — see [`ws/handler.ts`](packages/server/src/ws/handler.ts).
- All WS payloads are typed by [`packages/shared/src/events.ts`](packages/shared/src/events.ts) (`ClientEvents`, `ServerEvents`). Adding a new realtime event = add it to that file, handle it in `ws/handler.ts`, subscribe in the appropriate Zustand store (`packages/client/src/stores/`).
- `broadcastToServer` / `broadcastToChannel` / `broadcastToConversation` / `sendToUser` in [`ws/handler.ts`](packages/server/src/ws/handler.ts) are the fan-out helpers.

### Auth

- Passwords: argon2 hash. Sessions: random tokens stored in `sessions` table with expiry.
- Client gets a token from `/api/auth/login` or `/register` and sends it as `Authorization: Bearer <token>` on HTTP and `?token=` on WS connect. (Cookies are configured via `cookie-parser` but the client uses Bearer headers.) See [`packages/server/src/auth/sessions.ts`](packages/server/src/auth/sessions.ts) and [`packages/client/src/lib/api.ts`](packages/client/src/lib/api.ts).
- `sessionMiddleware` gates everything under `/api/{servers,channels,messages,voice,uploads,gifs,conversations,admin}`.

### Database

- Single SQLite file, WAL mode, foreign keys ON. Init + migrations live in [`packages/server/src/db/index.ts`](packages/server/src/db/index.ts) and run automatically on server startup.
- Migrations are **idempotent** — `CREATE TABLE IF NOT EXISTS` and `pragma_table_info` checks before `ALTER TABLE`. There's no migration framework and no migration history table. To add a column, append another `pragma_table_info` guard at the bottom of `runMigrations`. Don't reorder existing blocks.
- All queries are raw `db.prepare(...)` — no ORM. Snake-case columns, camelCase TypeScript fields; mapping is done explicitly at each query site.

### Voice

- Server mints LiveKit JWTs scoped to a room named after the channel ID ([`routes/voice.ts`](packages/server/src/routes/voice.ts)).
- Client uses `livekit-client` directly to join the room. Presence-in-voice is tracked separately via the `voice:join` / `voice:leave` WS events and `presenceTracker`, then broadcast as `presence:update`.
- Screen sharing: Electron main process exposes `desktopCapturer` via IPC ([`main/index.ts`](packages/client/src/main/index.ts) + [`preload/index.ts`](packages/client/src/preload/index.ts)). Renderer picks a source and publishes it as a LiveKit screen share track.

### Music bot ("Melody")

- One `ChannelMusicSession` per voice channel, kept in [`music/queue-controller.ts`](packages/server/src/music/queue-controller.ts).
- The bot joins as a LiveKit participant with identity `melody-bot` and publishes a single audio track. Other participants subscribe like any other voice user.
- Audio path: `yt-dlp` resolves stream URL → `ffmpeg` decodes to s16le 48kHz stereo PCM → frames pushed via `AudioSource.captureFrame`. See [`audio-pipeline.ts`](packages/server/src/music/audio-pipeline.ts).
- Pause = keep streaming silence frames (don't tear down the publisher, or remote subscribers desync).
- `streamGeneration` counter on the session is the cancellation token — `stop()`/`skip()` increment it, in-flight stream event handlers no-op when their captured generation doesn't match. Respect this pattern when modifying.
- Auto-leaves the channel after 5 min of an empty queue.
- **Requires `ffmpeg` on the server's PATH.** No vendored binary.

### Client state

Zustand stores in [`packages/client/src/stores/`](packages/client/src/stores), one per concern: `auth`, `connection`, `chat`, `dm`, `voice`, `presence`, `music`, `audio-settings`. WS event subscriptions live alongside the relevant store. The shell ([`app-shell.tsx`](packages/client/src/components/layout/app-shell.tsx)) composes them.

## Conventions and gotchas

- **ESM everywhere.** Server `package.json` has `"type": "module"`. Imports must include `.js` extensions even for `.ts` source — that's a `moduleResolution: bundler` requirement. Match the existing style.
- **Strict TS, no `any` without reason.** Cast `db.prepare(...).get(...)` results to a typed shape inline; that's the established pattern.
- **Time is unix seconds** in the database (`unixepoch()`), but milliseconds in the WS layer for music position. Don't mix them.
- **IDs are `nanoid()`** — strings, not UUIDs.
- **No test suite exists.** When changing critical paths (auth, voice token issuance, music streaming), verify by hand against a running dev server.
- **No linter or formatter is configured.** Match surrounding style.
- **`pnpm.onlyBuiltDependencies`** is intentional. Don't add native-binding packages without adding them to that allowlist or `pnpm install` will skip their build scripts.
- **Worktrees:** Claude Code is configured to work in `.claude/worktrees/`. If you find yourself in one, the parent repo is at `C:\repos\faceless`.

## Build and release

- **Server Docker image:** [`packages/server/Dockerfile`](packages/server/Dockerfile) — multi-stage-ish, builds shared then server, exposes 3000.
- **Client installers:** `pnpm --filter @faceless/client dist` (Windows portable .exe) or `dist:linux` (AppImage). Output to `packages/client/release/`. Config in [`electron-builder.yml`](packages/client/electron-builder.yml).
- **Release flow:** Bump `version` in all four `package.json` files (root + each package) in the same commit, merge to `main`. The [`release.yml`](.github/workflows/release.yml) workflow checks if a tag matching the version exists; if not, it builds Windows + Linux artifacts and creates a GitHub Release tagged `v<version>`.

## Where to start for common tasks

- **Add an HTTP endpoint:** new route file under [`packages/server/src/routes/`](packages/server/src/routes), mount it in [`index.ts`](packages/server/src/index.ts), add a typed wrapper in [`packages/client/src/lib/api.ts`](packages/client/src/lib/api.ts).
- **Add a realtime event:** declare in [`packages/shared/src/events.ts`](packages/shared/src/events.ts) → run `pnpm run build:shared` → handle in [`packages/server/src/ws/handler.ts`](packages/server/src/ws/handler.ts) → subscribe via `wsClient.on(...)` in the appropriate store.
- **Add a DB column:** append an idempotent `pragma_table_info` + `ALTER TABLE` block at the bottom of `runMigrations` in [`packages/server/src/db/index.ts`](packages/server/src/db/index.ts).
- **Add a UI screen:** new component under [`packages/client/src/components/`](packages/client/src/components), wire into [`app-shell.tsx`](packages/client/src/components/layout/app-shell.tsx) or the relevant parent.
- **Touch the Electron main process:** [`packages/client/src/main/index.ts`](packages/client/src/main/index.ts) for window/IPC, [`preload/index.ts`](packages/client/src/preload/index.ts) for the renderer-facing surface (whitelisted via `contextBridge`).
