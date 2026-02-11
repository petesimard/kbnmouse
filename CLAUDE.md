# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A secure kiosk desktop environment for children with parental controls. Three components: an Electron desktop app (kiosk-app), a React+Express web server (kiosk-server), and Linux system setup scripts (kiosk-setup). Project is
called kbnmouse.

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

**kiosk-app/** — Electron app running in kiosk mode on Linux. Uses a dual BrowserView layout: content view (90% top, displays web pages/apps) and menu view (10% bottom bar, trusted navigation). Content view has no Node.js access. Menu view communicates with main process via preload script IPC (`window.kiosk.*`). Enforces a domain whitelist — unauthorized URLs show a blocked page. Can launch native Linux apps with time tracking and limit enforcement.

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

### App Types

Three types stored in `apps.app_type`: `url` (web pages), `builtin` (React components at `/builtin/:key`), `native` (Linux desktop apps launched as child processes).

### Time Limit System

Apps can have `daily_limit_minutes` and `weekly_limit_minutes`. Bonus minutes earned through challenges (`challenge_completions` table) or parent grants are added to limits. Usage tracked in `app_usage` table. Native app launcher calculates remaining time and auto-kills when expired.

### Game Creator

Kids can create custom Three.js games by describing what they want. The system uses Claude Code Agent SDK (`@anthropic-ai/claude-agent-sdk`) to generate self-contained HTML game files.

**Frontend flow:**
- `/builtin/gamecreator` — Builtin "My Games" list (`src/components/builtin/GameCreator.jsx`). Shows all games for the active profile with status badges (Generating/Ready/Error). Has a creation form (name + prompt). On create, navigates to the management page.
- `/game/:id` — Game management page (`src/pages/GameManage.jsx`). Shows game status, PLAY button (enabled when ready), share (QR code), delete, and an "Update Game" form for iterative modifications. Polls every 3s while status is `generating`.

**Backend flow:**
- `server/routes/gamecreator.js` — CRUD API at `/api/games`. POST creates a `custom_games` record with status `generating` and kicks off background generation. On completion, `onGameReady()` sets status to `ready`, creates/finds a "My Games" folder (icon 🎮, color #6366f1), and adds an app entry (type `url`, URL `/game/:id`) so the game appears in the menu.
- `server/agent/gameAgent.js` — Wraps `@anthropic-ai/claude-agent-sdk`'s `query()` function. Gives the agent a system prompt requesting a kid-friendly Three.js game, allows `Write, Edit, Read, Bash, Glob` tools, max 30 turns, `bypassPermissions` mode. Agent writes files to `data/games/<id>/`. Both `generateGame()` and `updateGame()` verify the agent actually wrote files.

**Game serving:**
- Games are static files in `data/games/<id>/` served at `/customgames/<id>/`.
- `server/index.js` middleware intercepts HTML requests with `?kiosk=1` query param and injects a fixed-position Back button overlay (bottom-left) that navigates to `/game/<id>`. This button appears when playing from the management page but not when accessing via shared QR code URLs (which lack the param).
- Vite proxies `/customgames` to Express in dev mode.

**Key details:**
- Games are profile-scoped (`custom_games.profile_id`).
- Menu app entries link to `/game/<id>` (management page), not directly to the game.
- Three-state status lifecycle: `generating` → `ready` | `error`.
- Delete removes the app entry, DB record, and game directory from disk.
