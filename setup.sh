#!/bin/bash
#
# Kids Desktop - One-line setup
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/petesimard/kids-desktop/main/setup.sh | bash
#
# Or clone first and run:
#   git clone https://github.com/petesimard/kids-desktop.git && cd kids-desktop && bash setup.sh
#
set -e

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

# --- Check prerequisites ---
step "Checking prerequisites"

if ! command -v git &>/dev/null; then
  error "git is not installed. Install it first:"
  echo "  sudo apt install git   # Debian/Ubuntu"
  echo "  sudo dnf install git   # Fedora"
  exit 1
fi
info "git found"

# Check for Node.js
if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Install Node.js 18+ first:"
  echo "  https://nodejs.org/"
  echo ""
  echo "  Or via nvm:"
  echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash"
  echo "    nvm install 20"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js 18+ required (found v$(node -v | sed 's/v//'))"
  exit 1
fi
info "Node.js $(node -v) found"

if ! command -v npm &>/dev/null; then
  error "npm is not installed"
  exit 1
fi
info "npm $(npm -v) found"

# --- Clone if needed ---
REPO_URL="https://github.com/petesimard/kids-desktop.git"
INSTALL_DIR="kids-desktop"

if [ -f "kiosk-server/package.json" ] && [ -f "kiosk-app/package.json" ]; then
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

# --- Install kiosk-server ---
step "Installing kiosk-server dependencies"
cd "$PROJECT_DIR/kiosk-server"
npm install
info "kiosk-server dependencies installed"

# --- Install kiosk-app ---
step "Installing kiosk-app dependencies"
cd "$PROJECT_DIR/kiosk-app"
npm install
info "kiosk-app dependencies installed"

# --- Build frontend ---
step "Building frontend"
cd "$PROJECT_DIR/kiosk-server"
npm run build
info "Frontend built"

# --- Done ---
echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Kids Desktop installed successfully!${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}To start the server (development):${NC}"
echo "  cd $PROJECT_DIR/kiosk-server"
echo "  npm run dev"
echo ""
echo -e "${BOLD}Then open:${NC}"
echo "  http://localhost:3000            # Kiosk UI"
echo "  http://localhost:3000/dashboard  # Parent Dashboard"
echo ""
echo -e "${BOLD}To start the Electron kiosk app:${NC}"
echo "  cd $PROJECT_DIR/kiosk-app"
echo "  npm run dev"
echo ""
echo -e "${BOLD}For full kiosk mode on Linux:${NC}"
echo "  sudo bash $PROJECT_DIR/kiosk-setup/install.sh"
echo ""
