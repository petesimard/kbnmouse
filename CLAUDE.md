# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A secure kiosk desktop environment for children with parental controls. Three components: an Electron desktop app (kiosk-app), a React+Express web server (kiosk-server), and Linux system setup scripts (kiosk-setup).

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
- `/dashboard` — PIN-protected parent dashboard with sub-routes: `/dashboard` (apps management), `/dashboard/challenges`, `/dashboard/usage` (7-day charts), `/dashboard/profiles` (profile management), `/dashboard/settings` (PIN, challenge config). All data pages are scoped by a profile selector in the sidebar.
- `/builtin/:key` — Built-in apps (clock, drawing, timer, calculator, challenges). Auto-discovered via `import.meta.glob`.

### Backend

- `server/index.js` — Express API with public and admin (token-protected via `X-Admin-Token` header) endpoints. Profile CRUD and active-profile endpoints.
- `server/db.js` — SQLite schema init (WAL mode). Tables: `profiles`, `apps`, `app_usage`, `challenges`, `challenge_completions`, `settings`. Exports `seedProfileDefaults(profileId)` for seeding new profiles with default apps/challenges.
- WebSocket server on same port broadcasts `{ type: 'refresh' }` when apps/profiles change — menu auto-reloads.

### Multi-Profile System

Each child has their own profile with isolated apps, challenges, usage tracking, and challenge completions. The `profiles` table stores id, name, icon, sort_order. All data tables (`apps`, `challenges`, `app_usage`, `challenge_completions`) have a `profile_id` column. API endpoints accept `?profile=<id>` query param or `profile_id` in request body to scope data.

**Profile selection flow (Electron):** Menu detects no active profile → loads `/profiles` in content view via IPC → child picks profile → `POST /api/active-profile` persists choice and broadcasts WS refresh → menu picks up new profile and loads scoped apps. Menu and content view are separate BrowserViews with separate React instances; they communicate via the API + WebSocket, not shared React context.

**ProfileContext** (`src/contexts/ProfileContext.jsx`) provides `profileId`, `profiles`, `selectProfile`, `clearProfile`, `refreshProfiles`. Used by the Challenges builtin and Dashboard (each in their own React instance). The menu's WebSocket handler calls `refreshProfiles()` on every refresh signal using stable refs to avoid WebSocket reconnection churn.

### Key Data Flow

1. Menu fetches apps from `/api/apps?profile=<id>`, connects to WebSocket for live updates
2. App clicks → Electron IPC → content view navigates (URL apps) or native process spawns (native apps)
3. Native apps: usage recorded to `/api/apps/:id/usage`, time limits enforced (daily/weekly + bonus minutes from challenges)
4. Dashboard: PIN verified via `/api/admin/verify-pin` → token stored in localStorage → passed in `X-Admin-Token` header. Profile selector in sidebar scopes all dashboard pages.

### API Authentication

Public endpoints need no auth. Admin endpoints require `X-Admin-Token` header with token from PIN verification. Frontend handles 401 by clearing token and redirecting to PIN entry.

### Frontend API Layer

`src/api/apps.js`, `src/api/challenges.js`, `src/api/profiles.js` — Centralized fetch functions with automatic token management and 401 handling. Custom hooks (`useApps`, `useChallenges`, `useProfiles`, `usePinAuth`, `useSettings`, `useBuiltinApps`) wrap these. Apps and challenges API functions accept optional `profileId` param for scoping.

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
