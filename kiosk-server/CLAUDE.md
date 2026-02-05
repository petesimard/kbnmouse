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
- `src/api/challenges.js` — Challenge admin API functions
- `src/api/profiles.js` — Profile CRUD and active-profile API functions
- `src/contexts/ProfileContext.jsx` — React context providing `profileId`, `profiles`, `selectProfile`, `clearProfile`, `refreshProfiles`
- `src/hooks/` — Custom hooks: `useApps`, `useChallenges`, `useProfiles`, `usePinAuth`, `useSettings`, `useBuiltinApps`
- `src/components/builtin/` — Built-in apps auto-discovered via `import.meta.glob`
- `src/pages/ProfileSelect.jsx` — "Who's Playing?" profile selection screen (loaded in content view)
- `src/pages/dashboard/` — Dashboard sub-pages (apps, challenges, usage, profiles, settings) with sidebar nav and profile selector
- `server/index.js` — Express API (public + admin endpoints), profile endpoints, and WebSocket server
- `server/db.js` — SQLite schema initialization (WAL mode), profile migration, `seedProfileDefaults()` export
- `data/kiosk.db` — SQLite database (auto-created on first run)

## API Authentication

Admin endpoints require `X-Admin-Token` header. Token obtained from `POST /api/admin/verify-pin`. Frontend auto-clears token on 401 responses.

## Database Tables

`profiles` (id, name, icon, sort_order), `apps` (with app_type: url/builtin/native, daily/weekly limit fields, profile_id), `challenges` (challenge config, profile_id), `app_usage` (duration tracking, profile_id), `challenge_completions` (bonus time awards, profile_id), `settings` (key-value config including hashed PIN and active_profile).

## Multi-Profile System

Each profile gets isolated apps, challenges, usage, and completions. All data tables have `profile_id`. API endpoints accept `?profile=<id>` or `profile_id` in body. Migration creates a "Default" profile for existing data. New profiles are seeded with default apps/challenges via `seedProfileDefaults()`. The menu and content view are separate Electron BrowserViews communicating via API + WebSocket (not shared React context).
