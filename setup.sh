#!/bin/bash
#

set -e

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
step()  { echo -e "\n${BOLD}→ $1${NC}"; }

# --- Must run as root ---
if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root."
  echo "  Usage: sudo bash setup.sh [--dev]"
  echo ""
  echo "  Or via curl:"
  echo "    curl -fsSL https://raw.githubusercontent.com/petesimard/kbnmouse/main/setup.sh | sudo bash"
  echo "    curl -fsSL https://raw.githubusercontent.com/petesimard/kbnmouse/main/setup.sh | sudo bash -s -- --dev"
  exit 1
fi

# --- Detect distro ---
step "Detecting distribution"

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
  # Fallback: detect by available package manager
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

info "Detected: $DISTRO ($PKG_INSTALL)"

# --- Install git if missing ---
step "Checking prerequisites"

if ! command -v git &>/dev/null; then
  warn "git not found, installing..."
  $PKG_INSTALL git
fi
info "git found"

# --- Install Node.js if missing ---
if ! command -v node &>/dev/null; then
  warn "Node.js not found, installing..."
  case "$DISTRO" in
    debian)
      $PKG_INSTALL nodejs npm
      ;;
    fedora|rhel)
      $PKG_INSTALL nodejs npm
      ;;
    arch)
      $PKG_INSTALL nodejs npm
      ;;
    suse)
      $PKG_INSTALL nodejs npm
      ;;
  esac
fi

if ! command -v node &>/dev/null; then
  error "Failed to install Node.js. Install Node.js 18+ manually:"
  echo "  https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js 18+ required (found v$(node -v | sed 's/v//'))"
  echo "  The version from your distro's repos is too old."
  echo "  Install a newer version via https://nodejs.org/ or nvm:"
  echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash"
  echo "    nvm install 20"
  exit 1
fi
info "Node.js $(node -v) found"

if ! command -v npm &>/dev/null; then
  error "npm is not installed"
  exit 1
fi
info "npm $(npm -v) found"

# --- Clone if needed ---
REPO_URL="https://github.com/petesimard/kbnmouse.git"
INSTALL_DIR="kbnmouse"

if [ -f "kiosk-app/package.json" ]; then
  # Already inside the project directory
  PROJECT_DIR="$(pwd)"
  info "Already in project directory"
elif [ -d "$INSTALL_DIR" ]; then
  step "Updating existing clone"
  cd "$INSTALL_DIR"
  git pull
  PROJECT_DIR="$(pwd)"
  info "Updated to latest"
else
  step "Cloning repository"
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
  PROJECT_DIR="$(pwd)"
  info "Cloned to $PROJECT_DIR"
fi

# --- Install kiosk-app ---
if $DEV_MODE; then
  step "Installing kiosk-app dependencies (dev mode)"
  cd "$PROJECT_DIR/kiosk-app"
  npm install
  info "kiosk-app dependencies installed"
else
  info "Skipping kiosk-app npm install (AppImage mode)"
fi

# --- Run kiosk system install ---
step "Installing kiosk system configuration"
if $DEV_MODE; then
  bash "$PROJECT_DIR/kiosk-setup/install.sh" --dev
else
  bash "$PROJECT_DIR/kiosk-setup/install.sh"
fi
