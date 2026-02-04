# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also: `../CLAUDE.md` for full project architecture.

## Commands

```bash
npm run dev      # Start both API server and Vite dev server concurrently
npm run server   # Start API server only (port 3001)
npm run client   # Start Vite dev server only (port 3000)
npm run build    # Build for production (outputs to dist/)
```

Do not try to kill or run the servers yourself.

## Stack

React 19 + Vite 5 + Tailwind CSS 4 (frontend), Express 5 + better-sqlite3 + ws (backend). ES modules throughout (`"type": "module"`).

## Structure

- `src/` — React frontend (routes, components, hooks, API layer)
- `src/api/apps.js` — Centralized fetch functions with token management and 401 handling
- `src/hooks/` — Custom hooks: `useApps`, `usePinAuth`, `useSettings`, `useBuiltinApps`
- `src/components/builtin/` — Built-in apps auto-discovered via `import.meta.glob`
- `src/pages/dashboard/` — Dashboard sub-pages (apps, usage, settings) with sidebar nav
- `server/index.js` — Express API (public + admin endpoints) and WebSocket server
- `server/db.js` — SQLite schema initialization (WAL mode)
- `data/kiosk.db` — SQLite database (auto-created on first run)

## API Authentication

Admin endpoints require `X-Admin-Token` header. Token obtained from `POST /api/admin/verify-pin`. Frontend auto-clears token on 401 responses.

## Database Tables

`apps` (with app_type: url/builtin/native, daily/weekly limit fields), `app_usage` (duration tracking), `challenge_completions` (bonus time awards), `settings` (key-value config including hashed PIN).
