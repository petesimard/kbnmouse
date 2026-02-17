#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="/opt/kbnmouse"

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
echo "  - Clone the repository to $INSTALL_DIR"
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


# --- Clone repository ---
REPO_URL="$(cd "$PROJECT_ROOT" && git remote get-url origin 2>/dev/null || true)"

if [[ -z "$REPO_URL" ]]; then
  error "Could not detect git remote origin. Is this a git repository?"
  exit 1
fi

echo "Cloning repository to $INSTALL_DIR..."
if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Existing clone found at $INSTALL_DIR — pulling latest"
  cd "$INSTALL_DIR"
  sudo -u "$KIOSK_USER" git pull
else
  rm -rf "$INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
  chown -R "$KIOSK_USER:$KIOSK_USER" "$INSTALL_DIR"
fi

info "Repository cloned from $REPO_URL"

echo "Installing npm dependencies (this may take a moment)..."
cd "$INSTALL_DIR/kiosk-app"
sudo -u "$KIOSK_USER" npm install

echo ""
info "=== Kiosk mode installed successfully! ==="
echo "Kiosk user: $KIOSK_USER"
echo "Installed to: $INSTALL_DIR"
echo "Update with: cd $INSTALL_DIR && git pull && cd kiosk-app && npm install"
echo "Reboot to start kiosk mode."
