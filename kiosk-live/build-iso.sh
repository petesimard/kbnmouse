#!/bin/bash
# build-iso.sh — Build a custom Linux Mint Live ISO preconfigured for kiosk mode
# Must run as root on a Debian/Ubuntu-based system.
#
# Usage:
#   sudo ./build-iso.sh [--iso <path>] [--clean]
#
# Options:
#   --iso <path>   Use a local Linux Mint ISO instead of downloading one
#   --clean        Remove working directories after building
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORK_DIR="$SCRIPT_DIR/work"
DOWNLOAD_DIR="$SCRIPT_DIR/downloads"
OUTPUT_NAME="kiosk-live-$(date +%Y%m%d).iso"

# --- Colors ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; }
step()  { echo -e "\n${BOLD}=== $1 ===${NC}"; }

# --- Parse arguments ---
LOCAL_ISO=""
DO_CLEAN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --iso)
      LOCAL_ISO="$2"
      shift 2
      ;;
    --clean)
      DO_CLEAN=true
      shift
      ;;
    *)
      error "Unknown option: $1"
      echo "Usage: sudo $0 [--iso <path>] [--clean]"
      exit 1
      ;;
  esac
done

# --- Must run as root ---
if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root."
  echo "  Usage: sudo $0 [--iso <path>] [--clean]"
  exit 1
fi

# --- Cleanup trap ---
cleanup_mounts() {
  local squashfs_dir="$WORK_DIR/squashfs"
  local iso_mount="$WORK_DIR/iso"

  # Unmount chroot bind mounts
  for mp in "$squashfs_dir/dev/pts" "$squashfs_dir/dev" "$squashfs_dir/proc" "$squashfs_dir/sys"; do
    mountpoint -q "$mp" 2>/dev/null && umount -lf "$mp" 2>/dev/null || true
  done

  # Unmount ISO
  mountpoint -q "$iso_mount" 2>/dev/null && umount -lf "$iso_mount" 2>/dev/null || true
}
trap cleanup_mounts EXIT

# --- Check dependencies ---
step "Checking dependencies"

MISSING=()
for cmd in xorriso unsquashfs mksquashfs wget; do
  if ! command -v "$cmd" &>/dev/null; then
    MISSING+=("$cmd")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  error "Missing required tools: ${MISSING[*]}"
  echo ""
  echo "Install them with:"
  echo "  sudo apt install xorriso squashfs-tools wget"
  exit 1
fi

info "All dependencies found"

# --- Obtain ISO ---
step "Obtaining Linux Mint ISO"

if [[ -n "$LOCAL_ISO" ]]; then
  if [[ ! -f "$LOCAL_ISO" ]]; then
    error "ISO file not found: $LOCAL_ISO"
    exit 1
  fi
  ISO_PATH="$LOCAL_ISO"
  info "Using local ISO: $ISO_PATH"
else
  mkdir -p "$DOWNLOAD_DIR"

  # Fetch the latest Linux Mint Cinnamon 64-bit ISO filename from the official mirror
  MINT_MIRROR="https://mirrors.kernel.org/linuxmint/stable"
  info "Checking for latest Linux Mint Cinnamon release..."

  # Get the latest version directory
  LATEST_VERSION=$(wget -q -O- "$MINT_MIRROR/" | grep -oP 'href="\K[0-9]+(\.[0-9]+)*(?=/")' | sort -V | tail -1)

  if [[ -z "$LATEST_VERSION" ]]; then
    error "Could not determine latest Linux Mint version from mirror."
    error "Use --iso <path> to provide a local ISO file instead."
    exit 1
  fi

  info "Latest version: $LATEST_VERSION"

  # Find the Cinnamon 64-bit ISO filename
  ISO_FILENAME=$(wget -q -O- "$MINT_MIRROR/$LATEST_VERSION/" | grep -oP 'href="\K[^"]*cinnamon-64bit[^"]*\.iso(?=")' | head -1)

  if [[ -z "$ISO_FILENAME" ]]; then
    error "Could not find Cinnamon 64-bit ISO for version $LATEST_VERSION."
    error "Use --iso <path> to provide a local ISO file instead."
    exit 1
  fi

  ISO_URL="$MINT_MIRROR/$LATEST_VERSION/$ISO_FILENAME"
  ISO_PATH="$DOWNLOAD_DIR/$ISO_FILENAME"

  if [[ -f "$ISO_PATH" ]]; then
    info "ISO already downloaded: $ISO_PATH"
  else
    info "Downloading: $ISO_URL"
    wget -c -O "$ISO_PATH" "$ISO_URL"
    info "Download complete"
  fi
fi

# --- Create working directories ---
step "Setting up working directories"

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/iso" "$WORK_DIR/custom"

info "Working directory: $WORK_DIR"

# --- Mount and copy ISO contents ---
step "Extracting ISO contents"

mount -o loop,ro "$ISO_PATH" "$WORK_DIR/iso"
info "ISO mounted"

cp -a "$WORK_DIR/iso/." "$WORK_DIR/custom/"
umount "$WORK_DIR/iso"
info "ISO contents copied to custom/"

# Make copied files writable
chmod -R u+w "$WORK_DIR/custom"

# --- Extract squashfs ---
step "Extracting squashfs filesystem"

SQUASHFS_PATH="$WORK_DIR/custom/casper/filesystem.squashfs"
if [[ ! -f "$SQUASHFS_PATH" ]]; then
  error "filesystem.squashfs not found at expected path: $SQUASHFS_PATH"
  exit 1
fi

unsquashfs -d "$WORK_DIR/squashfs" "$SQUASHFS_PATH"
info "Squashfs extracted"

# --- Prepare chroot ---
step "Preparing chroot environment"

SQUASHFS_DIR="$WORK_DIR/squashfs"

# Bind-mount essential filesystems
mount --bind /proc "$SQUASHFS_DIR/proc"
mount --bind /sys "$SQUASHFS_DIR/sys"
mount --bind /dev "$SQUASHFS_DIR/dev"
mount --bind /dev/pts "$SQUASHFS_DIR/dev/pts"

# Copy DNS config
cp /etc/resolv.conf "$SQUASHFS_DIR/etc/resolv.conf"

# Copy chroot setup script
cp "$SCRIPT_DIR/chroot-setup.sh" "$SQUASHFS_DIR/tmp/chroot-setup.sh"
chmod +x "$SQUASHFS_DIR/tmp/chroot-setup.sh"

# Copy kiosk-app source
cp -r "$PROJECT_ROOT/kiosk-app" "$SQUASHFS_DIR/tmp/kiosk-app"
# Remove node_modules and dev artifacts from the copy
rm -rf "$SQUASHFS_DIR/tmp/kiosk-app/node_modules"
rm -rf "$SQUASHFS_DIR/tmp/kiosk-app/data"
rm -rf "$SQUASHFS_DIR/tmp/kiosk-app/.env"

info "Chroot environment prepared"

# --- Run chroot setup ---
step "Running chroot setup (this will take a while)"

chroot "$SQUASHFS_DIR" /bin/bash /tmp/chroot-setup.sh

info "Chroot setup complete"

# --- Install session files ---
step "Installing session files"

cp "$SCRIPT_DIR/files/kiosk.desktop" "$SQUASHFS_DIR/usr/share/xsessions/kiosk.desktop"

cp "$SCRIPT_DIR/files/kiosk-start.sh" "$SQUASHFS_DIR/usr/local/bin/kiosk-start.sh"
chmod +x "$SQUASHFS_DIR/usr/local/bin/kiosk-start.sh"

info "Session files installed"

# --- Generate manifest (needs chroot mounts still active) ---
step "Generating filesystem manifest"

chroot "$SQUASHFS_DIR" dpkg-query -W --showformat='${Package} ${Version}\n' 2>/dev/null > "$WORK_DIR/custom/casper/filesystem.manifest" || true
info "Manifest generated"

# --- Clean up chroot mounts ---
step "Cleaning up chroot"

umount "$SQUASHFS_DIR/dev/pts"
umount "$SQUASHFS_DIR/dev"
umount "$SQUASHFS_DIR/proc"
umount "$SQUASHFS_DIR/sys"

# Remove temporary files
rm -f "$SQUASHFS_DIR/tmp/chroot-setup.sh"
rm -f "$SQUASHFS_DIR/etc/resolv.conf"

info "Chroot cleaned up"

# --- Rebuild squashfs ---
step "Rebuilding squashfs (this will take a while)"

rm -f "$SQUASHFS_PATH"
mksquashfs "$SQUASHFS_DIR" "$SQUASHFS_PATH" -comp xz -noappend

# Update filesystem.size
printf "%s" "$(du -sx --block-size=1 "$SQUASHFS_DIR" | cut -f1)" > "$WORK_DIR/custom/casper/filesystem.size"

info "Squashfs rebuilt"

# --- Modify boot configuration ---
step "Modifying boot configuration"

# Patch GRUB config (UEFI boot)
GRUB_CFG="$WORK_DIR/custom/boot/grub/grub.cfg"
if [[ -f "$GRUB_CFG" ]]; then
  # Add 'persistent' to linux boot lines and reduce timeout
  sed -i 's|file=/cdrom/preseed/linuxmint.seed|file=/cdrom/preseed/linuxmint.seed persistent|g' "$GRUB_CFG"
  sed -i 's|^set timeout=.*|set timeout=3|' "$GRUB_CFG"
  info "GRUB config patched"
else
  warn "GRUB config not found at $GRUB_CFG — skipping"
fi

# Patch isolinux config (BIOS boot)
ISOLINUX_CFG="$WORK_DIR/custom/isolinux/isolinux.cfg"
if [[ -f "$ISOLINUX_CFG" ]]; then
  sed -i 's|file=/cdrom/preseed/linuxmint.seed|file=/cdrom/preseed/linuxmint.seed persistent|g' "$ISOLINUX_CFG"
  sed -i 's|^timeout .*|timeout 30|' "$ISOLINUX_CFG"
  info "Isolinux config patched"
else
  warn "Isolinux config not found at $ISOLINUX_CFG — skipping"
fi

# --- Rebuild ISO ---
step "Building ISO"

# Detect the EFI boot image path
EFI_IMG=""
for candidate in "$WORK_DIR/custom/boot/grub/efi.img" "$WORK_DIR/custom/EFI/boot/efi.img"; do
  if [[ -f "$candidate" ]]; then
    EFI_IMG="$candidate"
    break
  fi
done

# Find isohdpfx.bin for hybrid MBR boot
ISOHDPFX=""
for candidate in /usr/lib/ISOLINUX/isohdpfx.bin /usr/lib/syslinux/mbr/isohdpfx.bin /usr/share/syslinux/isohdpfx.bin; do
  if [[ -f "$candidate" ]]; then
    ISOHDPFX="$candidate"
    break
  fi
done

if [[ -z "$ISOHDPFX" ]]; then
  warn "isohdpfx.bin not found — ISO will not be hybrid-bootable from USB"
  warn "Install isolinux or syslinux-common to enable hybrid boot"
fi

OUTPUT_PATH="$SCRIPT_DIR/$OUTPUT_NAME"

xorriso -as mkisofs \
  -iso-level 3 \
  -full-iso9660-filenames \
  -volid "KIOSK-LIVE" \
  -J -joliet-long \
  ${ISOHDPFX:+-isohybrid-mbr "$ISOHDPFX"} \
  -partition_offset 16 \
  -b isolinux/isolinux.bin \
  -c isolinux/boot.cat \
  -no-emul-boot \
  -boot-load-size 4 \
  -boot-info-table \
  ${EFI_IMG:+-eltorito-alt-boot -e "$(realpath --relative-to="$WORK_DIR/custom" "$EFI_IMG")" -no-emul-boot -isohybrid-gpt-basdat} \
  -o "$OUTPUT_PATH" \
  "$WORK_DIR/custom"

info "ISO built: $OUTPUT_PATH"
ls -lh "$OUTPUT_PATH"

# --- Cleanup ---
if $DO_CLEAN; then
  step "Cleaning up working directories"
  rm -rf "$WORK_DIR"
  info "Working directories removed"
else
  echo ""
  info "Working directories preserved at $WORK_DIR"
  info "Run with --clean to auto-remove, or delete manually: rm -rf $WORK_DIR"
fi

# --- Done ---
echo ""
echo -e "${GREEN}${BOLD}=== Build complete! ===${NC}"
echo ""
echo "ISO:  $OUTPUT_PATH"
echo "Size: $(du -h "$OUTPUT_PATH" | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Write to USB:  sudo dd if=$OUTPUT_PATH of=/dev/sdX bs=4M status=progress"
echo "  2. Create persistence partition on remaining USB space:"
echo "       sudo fdisk /dev/sdX   # create new partition after ISO"
echo "       sudo mkfs.ext4 -L casper-rw /dev/sdXN"
echo "  3. Boot from USB — kiosk will auto-start and show a pairing code"
echo "  4. Enter the pairing code in your parent dashboard"
