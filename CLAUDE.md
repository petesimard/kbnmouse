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

- `/menu` — Bottom navigation bar shown in Electron menu view. Fetches apps, manages whitelist, launches native apps.
- `/dashboard` — PIN-protected parent dashboard with sub-routes: `/dashboard` (apps management), `/dashboard/usage` (7-day charts), `/dashboard/settings` (PIN, challenge config).
- `/builtin/:key` — Built-in apps (clock, drawing, timer, calculator, challenges). Auto-discovered via `import.meta.glob`.

### Backend

- `server/index.js` — Express API with public and admin (token-protected via `X-Admin-Token` header) endpoints.
- `server/db.js` — SQLite schema init (WAL mode). Tables: `apps`, `app_usage`, `challenge_completions`, `settings`.
- WebSocket server on same port broadcasts `{ type: 'refresh' }` when apps change — menu auto-reloads.

### Key Data Flow

1. Menu fetches apps from `/api/apps`, connects to WebSocket for live updates
2. App clicks → Electron IPC → content view navigates (URL apps) or native process spawns (native apps)
3. Native apps: usage recorded to `/api/apps/:id/usage`, time limits enforced (daily/weekly + bonus minutes from challenges)
4. Dashboard: PIN verified via `/api/admin/verify-pin` → token stored in localStorage → passed in `X-Admin-Token` header

### API Authentication

Public endpoints need no auth. Admin endpoints require `X-Admin-Token` header with token from PIN verification. Frontend handles 401 by clearing token and redirecting to PIN entry.

### Frontend API Layer

`src/api/apps.js` — Centralized fetch functions with automatic token management and 401 handling. Custom hooks (`useApps`, `usePinAuth`, `useSettings`, `useBuiltinApps`) wrap these.

### App Types

Three types stored in `apps.app_type`: `url` (web pages), `builtin` (React components at `/builtin/:key`), `native` (Linux desktop apps launched as child processes).

### Time Limit System

Apps can have `daily_limit_minutes` and `weekly_limit_minutes`. Bonus minutes earned through challenges (`challenge_completions` table) or parent grants are added to limits. Usage tracked in `app_usage` table. Native app launcher calculates remaining time and auto-kills when expired.
