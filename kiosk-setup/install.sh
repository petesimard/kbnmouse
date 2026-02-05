#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# --- Must run as root ---
if [[ $EUID -ne 0 ]]; then
  echo "Error: This script must be run as root." >&2
  echo "Usage: sudo $0" >&2
  exit 1
fi

# --- Collect non-admin (non-sudo) user accounts ---
# Get human users (UID >= 1000, excluding nobody), filter out anyone in sudo/wheel/admin groups
admin_groups="sudo wheel admin"
admin_users=""
for group in $admin_groups; do
  members=$(getent group "$group" 2>/dev/null | cut -d: -f4)
  if [[ -n "$members" ]]; then
    admin_users="$admin_users,$members"
  fi
done

candidates=()
while IFS=: read -r username _ uid _ _ home shell; do
  # Skip system accounts and nobody
  [[ $uid -lt 1000 ]] && continue
  [[ $username == "nobody" ]] && continue
  # Skip users with nologin/false shells
  [[ $shell == */nologin ]] && continue
  [[ $shell == */false ]] && continue
  # Skip admin users
  if echo ",$admin_users," | grep -q ",$username,"; then
    continue
  fi
  candidates+=("$username")
done < /etc/passwd

# --- Handle no available accounts ---
if [[ ${#candidates[@]} -eq 0 ]]; then
  echo "No non-admin user accounts found."
  echo "You need a non-admin account for kiosk mode."
  echo ""
  echo "Opening user account manager..."

  # Try common user-management GUIs
  if command -v gnome-control-center &>/dev/null; then
    gnome-control-center user-accounts &
  elif command -v users-admin &>/dev/null; then
    users-admin &
  elif command -v kuser &>/dev/null; then
    kuser &
  elif command -v system-config-users &>/dev/null; then
    system-config-users &
  else
    echo "Could not find a graphical user manager." >&2
    echo "Create a user manually:  sudo adduser <username>" >&2
  fi
  exit 1
fi

# --- Let the user pick an account ---
echo "Available non-admin user accounts:"
echo ""
for i in "${!candidates[@]}"; do
  echo "  $((i + 1))) ${candidates[$i]}"
done
echo ""

while true; do
  read -rp "Select the kiosk user [1-${#candidates[@]}]: " choice
  if [[ $choice =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#candidates[@]} )); then
    KIOSK_USER="${candidates[$((choice - 1))]}"
    break
  fi
  echo "Invalid selection. Try again."
done

echo ""
echo "Using account: $KIOSK_USER"
echo ""

# --- Install system dependencies ---
echo "Installing system dependencies..."
apt install -y openbox unclutter nodejs npm

# --- Install kiosk session ---
echo "Installing kiosk session..."
cp "$SCRIPT_DIR/kiosk.desktop" /usr/share/xsessions/

echo "Installing kiosk startup script..."
cp "$SCRIPT_DIR/kiosk-start.sh" /usr/local/bin/
chmod +x /usr/local/bin/kiosk-start.sh

# --- Configure LightDM for selected user ---
echo "Configuring LightDM..."
cat > /etc/lightdm/lightdm.conf <<EOF
[Seat:*]
autologin-user=$KIOSK_USER
autologin-session=kiosk
EOF

# --- Configure AccountsService for selected user ---
echo "Configuring AccountsService for $KIOSK_USER..."
cat > "/var/lib/AccountsService/users/$KIOSK_USER" <<EOF
[User]
Session=kiosk
XSession=kiosk
SystemAccount=false
EOF

# --- Install Electron kiosk app ---
echo "Installing Electron kiosk app to /opt/kiosk-app..."
rm -rf /opt/kiosk-app
cp -r "$PROJECT_ROOT/kiosk-app" /opt/kiosk-app
chown -R "$KIOSK_USER:$KIOSK_USER" /opt/kiosk-app

echo "Installing npm dependencies (this may take a moment)..."
cd /opt/kiosk-app
sudo -u "$KIOSK_USER" npm install

echo ""
echo "=== Kiosk mode installed successfully! ==="
echo "Kiosk user: $KIOSK_USER"
echo "Reboot to start kiosk mode."
echo ""
echo "To access admin account: Press Ctrl+Alt+F1 for TTY, login, then run:"
echo "  sudo systemctl restart lightdm"
echo ""
echo "For development with hot-reload, run:"
echo "  cd /opt/kiosk-app && npm run dev"
