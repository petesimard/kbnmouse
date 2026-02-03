# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A minimal Vite development server configured as a kiosk display server, part of a larger kids-desktop project. The goal is to create a desktop environment for use by kids with strong parental controls. This server serves a single HTML page accessible from any device on the local network.

## Commands

```bash
npm run dev      # Start dev server at http://0.0.0.0:3000 (accessible on LAN)
npm run build    # Build for production (outputs to dist/)
npm run preview  # Preview production build
```

## Architecture

- **index.html** - Single-page static HTML with inline CSS. No JavaScript framework.
- **vite.config.js** - Configures Vite to listen on all network interfaces (`0.0.0.0:3000`) with `allowedHosts: true` for LAN access.

The server is designed to be accessed from other devices on the network (e.g., kiosk displays, tablets).
