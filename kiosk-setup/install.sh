#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Installing system dependencies..."
apt install -y openbox unclutter nodejs npm

echo "Installing kiosk session..."
cp "$SCRIPT_DIR/kiosk.desktop" /usr/share/xsessions/

echo "Installing kiosk startup script..."
cp "$SCRIPT_DIR/kiosk-start.sh" /usr/local/bin/
chmod +x /usr/local/bin/kiosk-start.sh

echo "Configuring LightDM..."
cp "$SCRIPT_DIR/lightdm.conf" /etc/lightdm/lightdm.conf

echo "Configuring AccountsService for alec_jaina..."
cp "$SCRIPT_DIR/alec_jaina" /var/lib/AccountsService/users/alec_jaina

echo "Installing Electron kiosk app to /opt/kiosk-app..."
rm -rf /opt/kiosk-app
cp -r "$PROJECT_ROOT/kiosk-app" /opt/kiosk-app
chown -R alec_jaina:alec_jaina /opt/kiosk-app

echo "Installing npm dependencies (this may take a moment)..."
cd /opt/kiosk-app
sudo -u alec_jaina npm install

echo ""
echo "=== Kiosk mode installed successfully! ==="
echo "Reboot to start kiosk mode."
echo ""
echo "To access admin account: Press Ctrl+Alt+F1 for TTY, login, then run:"
echo "  sudo systemctl restart lightdm"
echo ""
echo "For development with hot-reload, run:"
echo "  cd /opt/kiosk-app && npm run dev"
