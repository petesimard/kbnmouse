#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# --- Colors ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

# --- Must run as root ---
if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root."
  echo "  Usage: sudo $0" >&2
  exit 1
fi

# --- Detect distro ---
DISTRO=""
PKG_INSTALL=""

if [ -f /etc/os-release ]; then
  . /etc/os-release
  case "$ID" in
    ubuntu|debian|linuxmint|pop|elementary|zorin)
      DISTRO="debian"
      PKG_INSTALL="apt install -y"
      ;;
    fedora)
      DISTRO="fedora"
      PKG_INSTALL="dnf install -y"
      ;;
    rhel|centos|rocky|alma)
      DISTRO="rhel"
      PKG_INSTALL="dnf install -y"
      ;;
    arch|manjaro|endeavouros)
      DISTRO="arch"
      PKG_INSTALL="pacman -S --noconfirm"
      ;;
    opensuse*|sles)
      DISTRO="suse"
      PKG_INSTALL="zypper install -y"
      ;;
  esac
fi

if [[ -z "$DISTRO" ]]; then
  if command -v apt &>/dev/null; then
    DISTRO="debian"
    PKG_INSTALL="apt install -y"
  elif command -v dnf &>/dev/null; then
    DISTRO="fedora"
    PKG_INSTALL="dnf install -y"
  elif command -v pacman &>/dev/null; then
    DISTRO="arch"
    PKG_INSTALL="pacman -S --noconfirm"
  elif command -v zypper &>/dev/null; then
    DISTRO="suse"
    PKG_INSTALL="zypper install -y"
  else
    error "Unsupported distribution. Supported: Debian/Ubuntu, Fedora/RHEL, Arch, openSUSE"
    exit 1
  fi
fi

info "Detected distro family: $DISTRO"

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
  echo "Create a user manually:"
  case "$DISTRO" in
    debian)       echo "  sudo adduser <username>" ;;
    fedora|rhel)  echo "  sudo useradd -m <username> && sudo passwd <username>" ;;
    arch)         echo "  sudo useradd -m -s /bin/bash <username> && sudo passwd <username>" ;;
    suse)         echo "  sudo useradd -m <username> && sudo passwd <username>" ;;
  esac
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

case "$DISTRO" in
  debian)
    apt update -y
    $PKG_INSTALL openbox unclutter lightdm lightdm-gtk-greeter
    ;;
  fedora|rhel)
    $PKG_INSTALL openbox unclutter lightdm lightdm-gtk-greeter
    ;;
  arch)
    $PKG_INSTALL openbox unclutter lightdm lightdm-gtk-greeter
    ;;
  suse)
    $PKG_INSTALL openbox unclutter lightdm lightdm-gtk-greeter
    ;;
esac

info "System dependencies installed"

# --- Enable LightDM ---
echo "Enabling LightDM display manager..."
if command -v systemctl &>/dev/null; then
  # Disable other display managers that may conflict
  for dm in gdm gdm3 sddm lxdm; do
    systemctl disable "$dm" 2>/dev/null || true
  done
  systemctl enable lightdm
  info "LightDM enabled"
else
  warn "systemctl not found — enable LightDM manually"
fi

# --- Install kiosk session ---
echo "Installing kiosk session..."
cp "$SCRIPT_DIR/kiosk.desktop" /usr/share/xsessions/

echo "Installing kiosk startup script..."
cp "$SCRIPT_DIR/kiosk-start.sh" /usr/local/bin/
chmod +x /usr/local/bin/kiosk-start.sh

# --- Configure LightDM for selected user ---
echo "Configuring LightDM..."
mkdir -p /etc/lightdm
cat > /etc/lightdm/lightdm.conf <<EOF
[Seat:*]
autologin-user=$KIOSK_USER
autologin-session=kiosk
EOF

# --- Configure AccountsService for selected user ---
if [ -d /var/lib/AccountsService ] || command -v accountsservice &>/dev/null; then
  echo "Configuring AccountsService for $KIOSK_USER..."
  mkdir -p /var/lib/AccountsService/users
  cat > "/var/lib/AccountsService/users/$KIOSK_USER" <<EOF
[User]
Session=kiosk
XSession=kiosk
SystemAccount=false
EOF
  info "AccountsService configured"
else
  warn "AccountsService not found — skipping (LightDM autologin will still work)"
fi

# --- Install Electron kiosk app ---
echo "Installing Electron kiosk app to /opt/kiosk-app..."
rm -rf /opt/kiosk-app
cp -r "$PROJECT_ROOT/kiosk-app" /opt/kiosk-app
chown -R "$KIOSK_USER:$KIOSK_USER" /opt/kiosk-app

echo "Installing npm dependencies (this may take a moment)..."
cd /opt/kiosk-app
sudo -u "$KIOSK_USER" npm install

echo ""
info "=== Kiosk mode installed successfully! ==="
echo "Kiosk user: $KIOSK_USER"
echo "Reboot to start kiosk mode."
echo ""
echo "To access admin account: Press Ctrl+Alt+F1 for TTY, login, then run:"
echo "  sudo systemctl restart lightdm"
echo ""
echo "For development with hot-reload, run:"
echo "  cd /opt/kiosk-app && npm run dev"
echo ""
