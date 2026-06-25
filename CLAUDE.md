# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A secure kiosk desktop environment for children with parental controls. Three components: an Electron desktop app (kiosk-app), a React+Express web server (kiosk-server), and Linux system setup scripts (kiosk-setup). Project is
called kbnmouse.

Don't worry about backwards compatibility or fallbacks.

## Development Commands

### kiosk-server (React frontend + Express API)

```bash
cd kiosk-server
npm run dev      # Start both API server (port 3001) and Vite dev server (port 3000)
npm run server   # Express API only (port 3001)
npm run client   # Vite dev server only (port 3000)
npm run build    # Production build to dist/
```

### kiosk-app (Electron)

```bash
cd kiosk-app
npm run dev            # Electron with hot reload
npm run dev:external   # Electron pointing to external kiosk-server
```

**Do not try to kill or restart servers yourself.** The user manages server processes.

## Architecture

### Three Components

**kiosk-app/** — Electron app running in kiosk mode on Linux. Uses a dual BrowserView layout: content view (90% top, displays web pages/apps) and menu view (10% bottom bar, trusted navigation). Both views have `nodeIntegration: false` and `contextIsolation: true`. Menu view communicates with main process via preload script IPC (`window.kiosk.*`). Content view has a minimal preload exposing only `window.kioskCamera` for camera access. Enforces a domain whitelist — unauthorized URLs show a blocked page. Can launch native Linux apps with time tracking and limit enforcement.

**kiosk-server/** — Web app serving both the kiosk UI and parent dashboard. React 19 + Vite frontend with Tailwind CSS 4. Express 5 + SQLite backend. Vite proxies `/api` requests to Express (port 3001). Binds to `0.0.0.0:3000` for LAN access.

**kiosk-setup/** — Shell scripts to install kiosk mode on Linux (LightDM auto-login, Openbox window manager, auto-launches Electron).

### Frontend Routes

- `/menu` — Bottom navigation bar shown in Electron menu view. Fetches apps (scoped by active profile), manages whitelist, launches native apps. Shows switch-user button when multiple profiles exist.
- `/profiles` — Full-screen "Who's Playing?" profile selection. Loaded in the content view by the menu when no profile is active. After selection, navigates to `/test-content` and broadcasts refresh via WebSocket.
- `/dashboard` — Account-protected parent dashboard with sub-routes: `/dashboard` (apps management), `/dashboard/challenges`, `/dashboard/usage` (7-day charts), `/dashboard/profiles` (profile management), `/dashboard/kiosks` (kiosk pairing), `/dashboard/settings` (password, API keys). All data pages are scoped by a profile selector in the sidebar. Supports `?magic=<token>` and `?reset=<token>` query params for magic link login and password reset flows.
- `/builtin/:key` — Built-in apps (clock, drawing, timer, calculator, challenges). Auto-discovered via `import.meta.glob`.

### Backend

- `server/index.js` — Express API with public and admin (token-protected via `X-Admin-Token` header) endpoints. Profile CRUD and active-profile endpoints.
- `server/db.js` — SQLite schema init (WAL mode). Tables: `profiles`, `apps`, `app_usage`, `challenges`, `challenge_completions`, `settings`, `accounts`, `sessions`, `kiosks`, `pairing_codes`, `email_tokens`. Exports `seedProfileDefaults(profileId)` for seeding new profiles with default apps/challenges.
- WebSocket server on same port broadcasts `{ type: 'refresh' }` when apps/profiles change — menu auto-reloads.

### Multi-Profile System

Each child has their own profile with isolated apps, challenges, usage tracking, and challenge completions. The `profiles` table stores id, name, icon, sort_order. All data tables (`apps`, `challenges`, `app_usage`, `challenge_completions`) have a `profile_id` column. API endpoints accept `?profile=<id>` query param or `profile_id` in request body to scope data.

**Profile selection flow (Electron):** Menu detects no active profile → loads `/profiles` in content view via IPC → child picks profile → `POST /api/active-profile` persists choice and broadcasts WS refresh → menu picks up new profile and loads scoped apps. Menu and content view are separate BrowserViews with separate React instances; they communicate via the API + WebSocket, not shared React context.

**ProfileContext** (`src/contexts/ProfileContext.jsx`) provides `profileId`, `profiles`, `selectProfile`, `clearProfile`, `refreshProfiles`. Used by the Challenges builtin and Dashboard (each in their own React instance). The menu's WebSocket handler calls `refreshProfiles()` on every refresh signal using stable refs to avoid WebSocket reconnection churn.

### Key Data Flow

1. Menu fetches apps from `/api/apps?profile=<id>`, connects to WebSocket for live updates
2. App clicks → Electron IPC → content view navigates (URL apps) or native process spawns (native apps)
3. Native apps: usage recorded to `/api/apps/:id/usage`, time limits enforced (daily/weekly + bonus minutes from challenges)
4. Dashboard: email+password login → session token stored in localStorage → passed in `X-Admin-Token` header. Profile selector in sidebar scopes all dashboard pages.

### Electron IPC Architecture

The menu and content views are separate BrowserViews with separate preload scripts and no shared state. They communicate through three mechanisms:

**1. API + WebSocket (cross-view data sync):** Both views fetch from the Express API. The WebSocket broadcasts `{ type: 'refresh' }` when data changes — menu and builtins listen and reload. Use this for data that lives in the database.

**2. Main process IPC (Electron-native features):** Features that require Node.js or OS access (camera, filesystem, native apps, zoom) go through `ipcMain.handle` / `ipcRenderer.invoke` round-trips. Each view has its own preload exposing different APIs:
- **Menu preload** (`preload.js`) → `window.kiosk.*` — full access: `exec`, file I/O, content navigation, zoom, native app launching, camera device selection
- **Content preload** (`preload-content.js`) → `window.kioskCamera.*` — minimal: camera capture/stream only

**3. Main-to-content push (cross-view notifications):** When the menu changes a setting that affects the content view, the main process IPC handler sends a message directly to the content view via `contentView.webContents.send(channel, data)`. The content preload exposes an `onXxx(callback)` listener. Example: `camera:setDevice` handler sends `camera:deviceChanged` to the content view so the Home builtin can show/hide the camera button without restart.

**Important constraints:**
- `navigator.mediaDevices` is NOT available in Electron BrowserViews. Camera access uses ffmpeg via IPC (`spawn('ffmpeg', ['-f', 'v4l2', ...])`) instead.
- The content view preload must stay minimal — it loads arbitrary URLs. Never expose `exec`, file I/O, or other privileged APIs on `window.kioskCamera`.
- Settings that affect both views: store the value in the main process (not localStorage, which is per-view), persist to localStorage in the menu for reload, and push changes to the content view via IPC.
- When adding new IPC channels: add the handler in `main.js`, expose it in the appropriate preload, and use `ipcRenderer.invoke` (request/response) or `ipcRenderer.on` (push notifications).

### Authentication & Accounts

**Account system** — Multiple email+password accounts supported. Password hashed with `crypto.scryptSync` (`server/utils/password.js`). Fresh databases show a registration form; subsequent visits show login.

**Session management** — `server/middleware/auth.js` manages DB-backed sessions (24h expiry) in the `sessions` table. Exports: `createSession(accountId)`, `cleanupSessions()`, `requireAuth` middleware (checks `X-Admin-Token` header), `requireAnyAuth` middleware (checks admin or kiosk token), `requireKiosk` middleware (checks `X-Kiosk-Token` header), `hasAccount()`. All auth middleware sets `req.accountId`.

**Blanket auth** — `server/index.js` applies `requireAnyAuth` to all `/api` routes except `/api/auth/*` and `/api/pairing/*`. This means `req.accountId` is always available in route handlers.

**Auth routes** (`server/routes/auth.js`):
- `GET /api/auth/status` — returns `{ hasAccount }` (public)
- `POST /api/auth/register` — create account + session
- `POST /api/auth/login` — email + password → session token
- `POST /api/auth/magic-link` — send magic login link via Resend email API
- `POST /api/auth/verify-magic-link` — verify token → session
- `POST /api/auth/forgot-password` — send password reset email
- `POST /api/auth/reset-password` — verify token + set new password → session
- `POST /api/auth/change-password` — change password (requireAuth)
- `DELETE /api/auth/session` — logout (requireAuth)

**Email** — `server/services/email.js` sends via Resend API. Reads `resend_api_key` and `resend_from_email` from `settings` table. Configured in Dashboard > Settings.

**Frontend auth** — `src/hooks/useAuth.js` replaces old `usePinAuth`. `src/api/client.js` provides shared `getToken`/`setToken`/`clearToken`/`authHeaders`/`handleResponse` used by all API modules. `src/pages/dashboard/AuthGate.jsx` handles register/login/magic-link/password-reset flows.

### Account-Scoped Data (SECURITY-CRITICAL)

**All data is scoped to the authenticated account.** Profiles have an `account_id` column, and all profile-dependent data (apps, challenges, folders, usage, games, messages, bulletin pins) is accessed through profile ownership. No endpoint should ever return data belonging to another account.

**Required pattern for every route that touches profile-scoped data:**

1. **If the endpoint accepts a `profile` query param or `profile_id` in the body**, verify ownership before using it:
   ```js
   const profile = db.prepare('SELECT id FROM profiles WHERE id = ? AND account_id = ?').get(profileId, req.accountId);
   if (!profile) return res.status(404).json({ error: 'Profile not found' });
   ```

2. **If the endpoint accesses a resource by its own ID** (app, challenge, folder, game, message), look up the resource, then verify its `profile_id` belongs to the account:
   ```js
   const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);
   if (!app) return res.status(404).json({ error: 'App not found' });
   if (app.profile_id && !verifyProfileOwnership(app.profile_id, req.accountId)) {
     return res.status(404).json({ error: 'App not found' });
   }
   ```

3. **If the endpoint lists all resources without a profile filter**, scope to the account's profiles:
   ```js
   const profileIds = db.prepare('SELECT id FROM profiles WHERE account_id = ?').all(req.accountId).map(r => r.id);
   if (profileIds.length === 0) return res.json([]);
   const placeholders = profileIds.map(() => '?').join(',');
   const items = db.prepare(`SELECT * FROM table WHERE profile_id IN (${placeholders})`).all(...profileIds);
   ```

**When adding new tables or endpoints:** If the data is per-profile, it inherits account scoping through `profile_id`. Always add the ownership check. Never return unscoped query results. Use 404 (not 403) when ownership fails — don't leak that the resource exists.

**Dashboard frontend** uses `fetchAllProfiles()` (hits `/api/admin/profiles` with auth headers), not the public `fetchProfiles()`. The public `GET /api/profiles` also requires auth (via blanket middleware) and scopes by `account_id`.

### Kiosk Pairing

Kiosks register with the server via a 5-digit pairing code flow.

**Pairing routes** (`server/routes/pairing.js`):
- `POST /api/pairing/code` — kiosk generates 5-digit code (10min TTL)
- `POST /api/pairing/claim` — dashboard claims code → creates kiosk + issues token (requireAuth)
- `GET /api/pairing/status/:code` — kiosk polls for claim result (returns `kioskToken` when claimed)
- `GET /api/admin/kiosks` — list registered kiosks (requireAuth)
- `DELETE /api/admin/kiosks/:id` — remove a kiosk (requireAuth)

**Kiosk-app flow** (`kiosk-app/main.js`): On startup, checks `data/kiosk-registration.json` for saved token. If absent: shows "Connecting..." screen → `POST /api/pairing/code` → displays 5-digit code full-screen → polls `/api/pairing/status/:code` every 3s → on claim, saves token and proceeds to normal operation. Passes `X-Kiosk-Token` header in API calls (usage tracking).

**Dashboard page** — `/dashboard/kiosks` (`src/pages/dashboard/KiosksPage.jsx`) lets parents enter the pairing code and manage registered kiosks.

### Frontend API Layer

`src/api/client.js` — Shared token management and response handling. `src/api/apps.js`, `src/api/challenges.js`, `src/api/profiles.js`, `src/api/folders.js`, `src/api/auth.js` — Centralized fetch functions importing from `client.js`. Custom hooks (`useApps`, `useChallenges`, `useProfiles`, `useAuth`, `useSettings`, `useBuiltinApps`) wrap these. Apps and challenges API functions accept optional `profileId` param for scoping.

**Dashboard fetch convention (IMPORTANT):** Every `fetch()` call in dashboard pages and hooks used by the dashboard **must** use `authHeaders()` and `handleResponse()` from `src/api/client.js`. The blanket `requireAnyAuth` middleware rejects requests without a valid token, so bare `fetch()` calls will 401. Required pattern:
```js
import { authHeaders, handleResponse } from '../../api/client.js';
const res = await fetch('/api/example', { headers: authHeaders() });
const data = await handleResponse(res);
```
For POST/PUT/DELETE, `authHeaders()` already includes `Content-Type: application/json`:
```js
const res = await fetch('/api/example', {
  method: 'POST',
  headers: authHeaders(),
  body: JSON.stringify({ key: 'value' })
});
await handleResponse(res);
```
`handleResponse()` auto-clears the token and throws `UnauthorizedError` on 401. Dashboard pages should catch this and call `logout()`. Kiosk-facing pages (menu, builtins) can use bare `fetch()` because Electron injects the `X-Kiosk-Token` header automatically via `onBeforeSendHeaders`.

### App Types

Three types stored in `apps.app_type`: `url` (web pages), `builtin` (React components at `/builtin/:key`), `native` (Linux desktop apps launched as child processes).

### Time Limit System

Apps can have `daily_limit_minutes` and `weekly_limit_minutes`. Bonus minutes earned through challenges (`challenge_completions` table) or parent grants are added to limits. Usage tracked in `app_usage` table. Native app launcher calculates remaining time and auto-kills when expired.

### Game Creator (gamegen)

Kids describe a game and the system generates a self-contained Three.js game with AI-generated **textures** (OpenAI images) and **procedural mesh modules**. Ported from the standalone `gamegen` app. The Claude Code Agent SDK (`@anthropic-ai/claude-agent-sdk`) writes the game files; the server generates textures from the agent's manifest.

**Generation pipeline** (`server/gamegen/`):
- `agent.js` — wraps `query()`. System prompt requires `game.html` (importmap-based Three.js), procedural `meshes/<name>.js` modules exporting `build(textures)`, and a `manifest.json` (the source of truth for textures + meshes). Tools: `Read, Write, Edit, Glob, Grep`; sandboxed to the game dir via `canUseTool`; `permissionMode: 'dontAsk'`; model `claude-sonnet-4-6`. Also exports `refinePrompt()` (tool-less LLM call for texture refinement).
- `images.js` — `generateImage()` calls OpenAI (`gpt-image-1.5`) for each manifest texture. Uses the `OPENAI_API_KEY` environment variable (set in `kiosk-server/.env`).
- `git.js` — each game dir is its own git repo (`init`/`commitAll`/`log`/`revert`); every job commits, giving an undoable change history. `ensureRepo()` lazily inits a repo (capturing existing files) for games that lack their own `.git` — without it, git would walk up and operate on the **root project repo**. `commitAll` self-ensures; `log` returns `[]` and `revert` throws when a game has no own repo.
- `queue.js` — per-game serial job queue (`game_jobs` table). Jobs: `create-game`, `modify`, `refine-texture`, `refine-mesh`, `revert`. Different games run concurrently.
- `handlers.js` — job logic (`handleCreateGame`/`handleModify`/`handleRefineTexture`/`handleRefineMesh`/`handleRevert`) plus manifest sync into the `game_assets` table.

**DB:** `custom_games` (the game record, profile-scoped, `status` generating→ready|error), `game_jobs` (queue/progress log per game), `game_assets` (derived texture/mesh status, synced from `manifest.json`).

**Routes** (`server/routes/gamecreator.js`, mounted at `/api/games`, all account-scoped via `loadOwnedGame`): list/get/create/update/patch/delete, plus `/:id/jobs`, `/:id/jobs/:jobId`, `/:id/commits`, `/:id/commits/:hash/revert`, `/:id/textures`, `/:id/textures/:assetId/refine`, `/:id/meshes`, `/:id/meshes/:assetId/refine`. On create/update success the route updates `custom_games.status`; `onGameReady()` adds the game as a kiosk app.

**Frontend:**
- `/builtin/gamecreator` — "My Games" list + create form (name + prompt). This single builtin manages all of a profile's games.
- `/game/:id` (`src/pages/GameManage.jsx`) — manage page. PLAY button launches the game as its own full-screen kiosk app (it is NOT an embedded play tab). Job-progress banner, rename/share/delete/QR, and three tabs (`src/components/game/`): **Modify** (prompt + git history with revert), **Textures** (grid + refine), **Meshes** (rotating 3D previews + refine).

**Game serving & overlay:**
- Static files in `data/games/<id>/` served at `/customgames/<id>/`. The play entry is `game.html`.
- `server/index.js` injects a fixed "← Manage" overlay button into HTML served with `?kiosk=1`, navigating to `/game/<id>`. Shared QR links omit `?kiosk=1`, so no overlay.
- `GET /gamepreview/:id?file=meshes/<name>.js` — public rotating 3D mesh preview (reads `manifest.json` for texture associations, renders via the same importmap). Used by the Meshes tab.
- Vite proxies `/customgames` and `/gamepreview` to Express in dev.

**Key details:**
- Games are profile-scoped (`custom_games.profile_id`); each ready game becomes a `url` app in the profile's "My Games" folder (icon 🎮) pointing at `/customgames/<id>/game.html?kiosk=1`. `shared` games also get app entries in sibling profiles.
- Status lifecycle `generating → ready | error`; refine/revert jobs run while the game stays `ready` and playable.
- Delete removes app entries, the DB rows (`custom_games`/`game_jobs`/`game_assets`), and the game directory.
- Textures require `OPENAI_API_KEY` in the server environment; without it the game still builds (meshes/geometry), textures just fail individually.
