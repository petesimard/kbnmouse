#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# --- Parse flags ---
DEV_MODE=false
for arg in "$@"; do
  case "$arg" in
    --dev) DEV_MODE=true ;;
  esac
done

# --- Colors ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

# --- Banner ---
echo -e "${GREEN}"
cat << 'BANNER'
 █████   ████ ███████████             ██████   ██████
▒▒███   ███▒ ▒▒███▒▒▒▒▒███           ▒▒██████ ██████
 ▒███  ███    ▒███    ▒███ ████████   ▒███▒█████▒███
 ▒███████     ▒██████████ ▒▒███▒▒███  ▒███▒▒███ ▒███
 ▒███▒▒███    ▒███▒▒▒▒▒███ ▒███ ▒███  ▒███ ▒▒▒  ▒███
 ▒███ ▒▒███   ▒███    ▒███ ▒███ ▒███  ▒███      ▒███
 █████ ▒▒████ ███████████  ████ █████ █████     █████
▒▒▒▒▒   ▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒▒  ▒▒▒▒ ▒▒▒▒▒ ▒▒▒▒▒     ▒▒▒▒▒
BANNER
echo -e "${NC}"

# --- Must run as root ---
if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root."
  echo "  Usage: sudo $0" >&2
  exit 1
fi

# --- Confirm installation ---
echo "This will set up your system as a KBnM kiosk:"
echo "  - Create/use a dedicated 'kbnm' user account"
echo "  - Install LightDM, Openbox, and dependencies"
echo "  - Configure a kiosk X session"
if $DEV_MODE; then
  echo "  - Install the Electron kiosk app to /opt/kiosk-app (dev mode — from source)"
else
  echo "  - Install the Electron kiosk app to /opt/kiosk-app"
fi
echo ""
read -rp "Continue with installation? (n/Y): " confirm < /dev/tty
confirm="${confirm:-Y}"
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Installation cancelled."
  exit 0
fi
echo ""

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
      adduser --disabled-password --gecos "" "$KIOSK_USER"
      ;;
    *)
      useradd -m -s /bin/bash "$KIOSK_USER"
      ;;
  esac
  # Allow passwordless login
  passwd -d "$KIOSK_USER"
  info "Created user: $KIOSK_USER"
fi

# Ensure kbnm can login without a password (needed for LightDM autologin)
if getent group nopasswdlogin &>/dev/null; then
  usermod -aG nopasswdlogin "$KIOSK_USER"
fi

# --- Autologin prompt ---
read -rp "Automatically login as kiosk user on reboot? (n/Y): " autologin_choice < /dev/tty
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

FUSE_PKG=""
if ! $DEV_MODE; then
  case "$DISTRO" in
    debian|suse) FUSE_PKG="libfuse2" ;;
    fedora|rhel)  FUSE_PKG="fuse-libs" ;;
    arch)         FUSE_PKG="fuse2" ;;
  esac
fi

case "$DISTRO" in
  debian)
    apt update -y
    $PKG_INSTALL openbox unclutter lightdm lightdm-gtk-greeter $FUSE_PKG
    ;;
  fedora|rhel)
    $PKG_INSTALL openbox unclutter lightdm lightdm-gtk-greeter $FUSE_PKG
    ;;
  arch)
    $PKG_INSTALL openbox unclutter lightdm lightdm-gtk-greeter $FUSE_PKG
    ;;
  suse)
    $PKG_INSTALL openbox unclutter lightdm lightdm-gtk-greeter $FUSE_PKG
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
  # Some distros manage display managers via a symlink rather than systemctl enable
  if systemctl enable lightdm 2>/dev/null; then
    info "LightDM enabled via systemctl"
  else
    ln -sf /usr/lib/systemd/system/lightdm.service /etc/systemd/system/display-manager.service
    systemctl daemon-reload
    info "LightDM enabled via display-manager symlink"
  fi
else
  warn "systemctl not found — enable LightDM manually"
fi

# --- Install kiosk session ---
echo "Installing kiosk session..."
cp "$SCRIPT_DIR/kiosk.desktop" /usr/share/xsessions/

echo "Installing kiosk startup script..."
if $DEV_MODE; then
  cat > /usr/local/bin/kiosk-start.sh <<'STARTEOF'
#!/bin/bash

# Start window manager (needed for Electron)
openbox &

# Wait for X to be ready
sleep 2

# Launch Electron kiosk app from source
export KIOSK_DATA_DIR="/opt/kiosk-app/data"
cd /opt/kiosk-app
exec node_modules/.bin/electron . --no-sandbox
STARTEOF
else
  cat > /usr/local/bin/kiosk-start.sh <<'STARTEOF'
#!/bin/bash

# Start window manager (needed for Electron)
openbox &

# Wait for X to be ready
sleep 2

# Launch Electron kiosk AppImage
export KIOSK_DATA_DIR="/opt/kiosk-app/data"
exec /opt/kiosk-app/KBnMouse-Kiosk.AppImage --no-sandbox
STARTEOF
fi
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
INSTALL_DIR="/opt/kiosk-app"
mkdir -p "$INSTALL_DIR/data"

if $DEV_MODE; then
  echo "Installing Electron kiosk app from source to $INSTALL_DIR..."
  # Copy source files (exclude node_modules, dist, data — we'll npm install fresh)
  rsync -a --exclude='node_modules' --exclude='dist' --exclude='data' \
    "$PROJECT_ROOT/kiosk-app/" "$INSTALL_DIR/"
  cd "$INSTALL_DIR"
  npm install --omit=dev
  info "Kiosk app installed from source"
else
  echo "Installing Electron kiosk app (AppImage) to $INSTALL_DIR..."

  # Check for local AppImage first (from dev build), else download from GitHub
  LOCAL_APPIMAGE=$(ls -1 "$PROJECT_ROOT/kiosk-app/dist/"*AppImage 2>/dev/null | head -1)
  if [[ -n "$LOCAL_APPIMAGE" ]]; then
    info "Found local AppImage: $LOCAL_APPIMAGE"
    cp "$LOCAL_APPIMAGE" "$INSTALL_DIR/KBnMouse-Kiosk.AppImage"
  else
    echo "Downloading latest AppImage from GitHub..."
    REPO="petesimard/kbnmouse"
    LATEST_URL=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" \
      | grep "browser_download_url.*AppImage\"" | head -1 | cut -d '"' -f 4)
    if [[ -z "$LATEST_URL" ]]; then
      error "Could not find AppImage download URL. Build one with 'cd kiosk-app && npm run dist' or create a GitHub release."
      exit 1
    fi
    curl -L -o "$INSTALL_DIR/KBnMouse-Kiosk.AppImage" "$LATEST_URL"
  fi

  chmod +x "$INSTALL_DIR/KBnMouse-Kiosk.AppImage"
fi

chown -R "$KIOSK_USER:$KIOSK_USER" "$INSTALL_DIR"

echo ""
info "=== Kiosk mode installed successfully! ==="
echo "Kiosk user: $KIOSK_USER"
if $DEV_MODE; then
  echo "Source:   $INSTALL_DIR (dev)"
else
  echo "AppImage: $INSTALL_DIR/KBnMouse-Kiosk.AppImage"
fi
echo "Data dir: $INSTALL_DIR/data"
echo "Reboot to start kiosk mode."
