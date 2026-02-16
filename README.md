# kbnmouse

A secure kiosk desktop environment for kids. Locks down a Linux machine into a child-friendly launcher with parental controls, time limits, and per-child profiles — all managed from a web dashboard on any device on your network.


## Quick Install

Run on target machine running a compatible linux distro. Root required to modify system packages and update the login.

```bash
curl -fsSL https://raw.githubusercontent.com/petesimard/kbnmouse/main/setup.sh | sudo bash
```

### Dev Install (from source)

If no AppImage release exists yet, or you want to run from source:

```bash
curl -fsSL https://raw.githubusercontent.com/petesimard/kbnmouse/main/setup.sh | sudo bash -s -- --dev
```

This clones the repo, runs `npm install` in `kiosk-app/`, copies the source to `/opt/kiosk-app/`, and launches Electron directly instead of via AppImage.


## How It Works

The system has three components:

| Component | Role |
|-----------|------|
| **kiosk-app** | Electron app running fullscreen in kiosk mode. Dual BrowserView layout: 90% content area (untrusted, no Node access) + 10% bottom menu bar (trusted, IPC-enabled). Enforces a URL whitelist and can launch native Linux apps. |
| **kiosk-server** | React 19 + Vite frontend served by an Express 5 + SQLite backend. Hosts the kiosk UI, built-in apps, and the parent dashboard. Binds to `0.0.0.0:3000` for LAN access. |
| **kiosk-setup** | Shell scripts that configure LightDM autologin, install an Openbox X session, and launch the Electron app on boot. |

On boot, LightDM auto-logs in as a non-admin user, starts an Openbox session, and launches the Electron app fullscreen. The child sees a launcher menu at the bottom and content above. Parents manage everything from `http://<kiosk-ip>:3000/dashboard` on their phone or laptop.

## Requirements

- **OS:** Linux with X11 — Debian/Ubuntu, Fedora/RHEL, Arch, openSUSE (and derivatives)
- **Node.js:** 18+ (auto-installed from distro repos if missing)

Don't have Linux installed? [Linux Mint](https://linuxmint.com/edition.php?id=326) is a great choice — it's beginner-friendly, runs well on older hardware, and is fully compatible with kbnmouse.

The script requires root — it installs system packages, configures LightDM autologin, and sets up the kiosk X session. It will:

1. Check prerequisites (git, Node.js 18+, npm)
2. Clone the repo and install npm dependencies
3. Prompt you to select a non-admin user account for the kiosk
4. Install system packages (`openbox`, `unclutter`)
5. Copy `kiosk-app` to `/opt/kiosk-app`
6. Configure LightDM to autologin the selected user into the kiosk session

Reboot to start kiosk mode. To access your admin account while in kiosk mode: `Ctrl+Alt+F1` for a TTY, log in, then `sudo systemctl restart lightdm` to get back to the desktop.

## Development

### Server (React + Express)

```bash
cd kiosk-server
npm install
npm run dev        # Starts Express (port 3001) + Vite dev server (port 3000)
```

- `npm run server` — Express API only (port 3001)
- `npm run client` — Vite dev server only (port 3000)
- `npm run build` — Production build to `dist/`

Vite proxies `/api`, `/customgames`, and `/ws` to Express on port 3001.

### Electron App

```bash
cd kiosk-app
npm install
npm run dev            # Dev mode (windowed, hot reload)
npm run dev:external   # Dev mode, connects to external kiosk-server
```

In development, the Electron window runs windowed with a frame. In production, it runs fullscreen in kiosk mode.

### Configuration

`kiosk-app/config.json`:

```json
{
  "url": "http://<server-hostname>:3000",
  "useBuiltInServer": false,
  "builtInServerPort": 3000,
  "hotReloadWatch": "./public"
}
```

Environment variable overrides:

| Variable | Purpose |
|----------|---------|
| `KIOSK_URL` | Server URL |
| `KIOSK_USE_BUILT_IN_SERVER` | `false` to use external server |
| `KIOSK_PORT` | Override port (default 3000) |
| `NODE_ENV=development` | Windowed mode, hot reload |

## Architecture

### Kiosk Pairing

Kiosks register with the server via a 5-digit pairing code:

1. Electron app starts, checks `data/kiosk-registration.json` for a saved token
2. If no token: displays a 5-digit pairing code fullscreen and polls `/api/pairing/status/:code` every 3s
3. Parent enters the code in the dashboard at `/dashboard/kiosks`
4. Server creates a kiosk record, issues a token
5. Electron saves the token and proceeds to normal operation
6. All subsequent API calls include the `X-Kiosk-Token` header

### Dual BrowserView Layout

The Electron window contains two BrowserViews:

- **Content view** (top 90%) — Loads web pages, built-in apps, and the profile selector. No `preload`, no Node.js access. URL navigation is filtered through a domain whitelist.
- **Menu view** (bottom 10%) — Trusted navigation bar. Uses a preload script exposing `window.kiosk.*` IPC methods for URL navigation, native app launching, whitelist management, and file/system access.

Communication between the two views happens through the Express API + WebSocket, not shared React state.

### URL Whitelist

The menu provides the content view's allowed domains via IPC. Any navigation to a domain not on the whitelist shows a blocked page. Subdomains are matched with `www.` stripping. Localhost, `127.0.0.1`, and `::1` are always allowed.

### Native App Launching

The Electron app can launch native Linux desktop applications as child processes:

1. Menu sends `native:launch(command, appId)` via IPC
2. Electron minimizes itself and spawns the process
3. Usage is tracked against `app_usage` with start time and duration
4. Time limits are enforced: a warning fires 60s before expiration, then the process is killed
5. When the process exits (or is killed), Electron restores itself and records usage via `POST /api/apps/:id/usage`

The app scans `.desktop` files from standard XDG directories to discover installed applications.

### Multi-Profile System

Each child has their own profile with isolated apps, challenges, usage data, and settings. The `profiles` table stores `id`, `name`, `icon`, `sort_order`. All data tables include a `profile_id` foreign key. API endpoints accept `?profile=<id>` for scoping.

Profile selection flow in the Electron app:
1. Menu detects no active profile → loads `/profiles` in the content view
2. Child picks a profile → `POST /api/active-profile` persists the choice
3. WebSocket broadcasts a refresh → menu reloads with the selected profile's apps

### Time Limits

Apps can have `daily_limit_minutes`, `weekly_limit_minutes`, and a hard cap `max_daily_minutes`. Bonus minutes are earned through challenge completions. The native app launcher calculates remaining time from usage records and bonus minutes, warns 60s before expiration, and auto-kills the process when time runs out.

### Database

SQLite via `better-sqlite3` in WAL mode. Stored at `kiosk-server/data/kiosk.db`, auto-created on first run. Migrations run inline via `PRAGMA table_info` checks before `ALTER TABLE`. Tables:

`profiles`, `apps`, `app_usage`, `challenges`, `challenge_completions`, `folders`, `settings`, `accounts`, `sessions`, `kiosks`, `pairing_codes`, `email_tokens`, `custom_games`, `messages`, `bulletin_pins`

### Authentication

The parent dashboard uses email + password authentication (single account per server). Passwords are hashed with `crypto.scryptSync`. Sessions are stored in the `sessions` table with 24h TTL. The dashboard also supports magic link login and password reset via email (requires Resend API key configured in settings).

### WebSocket

A WebSocket server runs on the same port as Express (3001). It broadcasts `{ type: 'refresh' }` whenever apps, profiles, or other data changes. The menu auto-reloads its app list on refresh signals.

### Built-in Apps

Built-in React components served at `/builtin/:key`. Auto-discovered via `import.meta.glob` in `src/components/builtin/index.js`. Each builtin exports a `meta` object and a default component. Included: Home, Clock, Drawing, Timer, Calculator, Challenges, ChatBot, Image Generator, Game Creator, Messages.

### Game Creator

Kids describe a game and the system generates it using the Claude Code Agent SDK. Games are self-contained HTML/Three.js files stored in `data/games/<id>/` and served at `/customgames/<id>/`. Uses Google Gemini (Nano Banana) for image asset generation. Status lifecycle: `generating` → `ready` | `error`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 28, Openbox, LightDM |
| Frontend | React 19, React Router 7, Tailwind CSS 4, Vite 5 |
| Backend | Express 5, better-sqlite3, WebSocket (ws) |
| AI integrations | Claude Code Agent SDK, Google Generative AI |
| System | Debian/Ubuntu, X11, systemd |
