#!/bin/bash
# chroot-setup.sh — Runs inside the extracted squashfs via chroot
# Installs Node.js, system packages, creates the kiosk user, and configures the system
set -e

export DEBIAN_FRONTEND=noninteractive

GREEN='\033[0;32m'
NC='\033[0m'
info() { echo -e "${GREEN}[chroot]${NC} $1"; }

# --- Install Node.js 22.x LTS ---
info "Installing Node.js 22.x LTS..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
apt-get update -y
apt-get install -y nodejs

info "Node.js version: $(node --version)"
info "npm version: $(npm --version)"

# --- Install system packages ---
info "Installing system packages..."
apt-get install -y openbox unclutter lightdm lightdm-gtk-greeter x11-xserver-utils

# --- Create kbnm user ---
KIOSK_USER="kbnm"

if id "$KIOSK_USER" &>/dev/null; then
  info "User $KIOSK_USER already exists"
else
  info "Creating kiosk user: $KIOSK_USER"
  adduser --disabled-password --gecos "" "$KIOSK_USER"
  passwd -d "$KIOSK_USER"
fi

# Ensure nopasswdlogin group exists and user is in it
if ! getent group nopasswdlogin &>/dev/null; then
  groupadd nopasswdlogin
fi
usermod -aG nopasswdlogin "$KIOSK_USER"

# --- Install kiosk-app ---
info "Installing kiosk-app to /opt/kiosk-app..."
rm -rf /opt/kiosk-app
cp -r /tmp/kiosk-app /opt/kiosk-app
chown -R "$KIOSK_USER:$KIOSK_USER" /opt/kiosk-app

info "Running npm install (production)..."
cd /opt/kiosk-app
sudo -u "$KIOSK_USER" npm install --production

# --- Configure LightDM ---
info "Configuring LightDM..."
mkdir -p /etc/lightdm
cat > /etc/lightdm/lightdm.conf <<EOF
[Seat:*]
autologin-user=$KIOSK_USER
autologin-session=kiosk
EOF

# --- Configure AccountsService ---
info "Configuring AccountsService..."
mkdir -p /var/lib/AccountsService/users
cat > "/var/lib/AccountsService/users/$KIOSK_USER" <<EOF
[User]
Session=kiosk
XSession=kiosk
SystemAccount=false
EOF

# --- Disable other display managers ---
info "Disabling other display managers..."
for dm in gdm gdm3 sddm cinnamon-session; do
  systemctl disable "$dm" 2>/dev/null || true
done

# --- Enable LightDM ---
info "Enabling LightDM..."
if systemctl enable lightdm 2>/dev/null; then
  info "LightDM enabled via systemctl"
else
  ln -sf /usr/lib/systemd/system/lightdm.service /etc/systemd/system/display-manager.service
  info "LightDM enabled via display-manager symlink"
fi

# --- Clean up ---
info "Cleaning up..."
apt-get clean
rm -rf /tmp/kiosk-app
rm -f /root/.bash_history
history -c 2>/dev/null || true

info "Chroot setup complete!"
