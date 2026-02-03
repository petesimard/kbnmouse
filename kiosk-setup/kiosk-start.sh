#!/bin/bash

# Disable screen blanking and power management
xset s off
xset s noblank
xset -dpms

# Hide cursor after 0.5 seconds of inactivity
unclutter -idle 0.5 -root &

# Start window manager (needed for Electron)
openbox &

# Wait for X to be ready
sleep 2

# Launch Electron kiosk app
cd /opt/kiosk-app
/usr/bin/npm start
