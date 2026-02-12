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

# --- Setup kbnm user account ---
KIOSK_USER="kbnm"

if id "$KIOSK_USER" &>/dev/null; then
  # User exists — check it's not an admin
  is_admin=false
  for group in sudo wheel admin; do
    if id -nG "$KIOSK_USER" 2>/dev/null | grep -qw "$group"; then
      is_admin=true
      break
    fi
  done

  if $is_admin; then
    error "User '$KIOSK_USER' exists but has admin privileges (sudo/wheel/admin group)."
    error "The kiosk user must not be an administrator."
    error "Either remove '$KIOSK_USER' from admin groups or delete the account and re-run this script."
    exit 1
  fi

  info "Found existing non-admin user: $KIOSK_USER"
else
  # User does not exist — create it
  echo "Creating kiosk user '$KIOSK_USER'..."
  case "$DISTRO" in
    debian)
      adduser --disabled-password --gecos "Kiosk User" "$KIOSK_USER"
      ;;
    *)
      useradd -m -s /bin/bash -c "Kiosk User" "$KIOSK_USER"
      ;;
  esac
  info "Created user: $KIOSK_USER"
fi

# --- Autologin prompt ---
read -rp "Automatically login as kiosk user on reboot? (n/Y): " autologin_choice
autologin_choice="${autologin_choice:-Y}"

if [[ "$autologin_choice" =~ ^[Yy]$ ]]; then
  AUTOLOGIN=true
  info "Autologin enabled for $KIOSK_USER"
else
  AUTOLOGIN=false
  info "Autologin disabled — user will need to login manually"
fi

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

# --- Configure LightDM ---
echo "Configuring LightDM..."
mkdir -p /etc/lightdm
if $AUTOLOGIN; then
  cat > /etc/lightdm/lightdm.conf <<EOF
[Seat:*]
autologin-user=$KIOSK_USER
autologin-session=kiosk
EOF
else
  cat > /etc/lightdm/lightdm.conf <<EOF
[Seat:*]
autologin-session=kiosk
EOF
fi

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
