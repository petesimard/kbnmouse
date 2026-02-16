#!/bin/bash

# Start window manager (needed for Electron)
openbox &

# Wait for X to be ready
sleep 2

# Launch Electron kiosk AppImage
export KIOSK_DATA_DIR="/opt/kiosk-app/data"
exec /opt/kiosk-app/KBnMouse-Kiosk.AppImage --no-sandbox
