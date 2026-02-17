#!/bin/bash

# Start window manager (needed for Electron)
openbox &

# Wait for X to be ready
sleep 2

# Launch Electron kiosk app
cd /opt/kbnmouse/kiosk-app
/usr/bin/npm start
