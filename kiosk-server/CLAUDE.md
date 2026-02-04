# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A minimal Vite development server configured as a kiosk display server, part of a larger kids-desktop project. The goal is to create a desktop environment for use by kids with strong parental controls. This server serves a single HTML page accessible from any device on the local network.

## Commands

```bash
npm run dev      # Start both API server and Vite dev server concurrently
npm run server   # Start API server only (port 3001)
npm run client   # Start Vite dev server only (port 3000)
npm run build    # Build for production (outputs to dist/)
npm run preview  # Preview production build
```

## Architecture

- **Frontend (React + Vite)**
  - `src/` - React components and pages
  - `vite.config.js` - Configures Vite on `0.0.0.0:3000` with API proxy to port 3001

- **Backend (Express + SQLite)**
  - `server/index.js` - Express API server on port 3001
  - `server/db.js` - Database connection and schema initialization
  - `data/kiosk.db` - SQLite database (auto-created on first run)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps` | List all enabled apps |
| GET | `/api/apps/:id` | Get single app |
| POST | `/api/apps` | Create new app |
| PUT | `/api/apps/:id` | Update app |
| DELETE | `/api/apps/:id` | Delete app |

## Database Schema

**apps table:**
- `id` - Primary key
- `name` - App display name
- `url` - URL to load
- `icon` - Emoji icon
- `sort_order` - Display order
- `enabled` - Whether app is visible
- `created_at` - Timestamp

The server is designed to be accessed from other devices on the network (e.g., kiosk displays, tablets).

Do not try to kill or run the servers yourself.