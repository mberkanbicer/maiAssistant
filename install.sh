#!/bin/bash

set -e  # Exit on error

PLUGIN_NAME="maiAssistant"
PLUGIN_SRC_DIR="$(cd "$(dirname "$0")"; pwd)"
NODE_MODULES_DIR="$PLUGIN_SRC_DIR/node_modules"
LOG_FILE="/tmp/plugin_install.log"
MIN_NPM_VERSION="6.0.0"
BACKUP_DIR="/tmp/plugin_backup_$(date +%Y%m%d_%H%M%S)"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "ERROR: $1"
    exit 1
}

cleanup() {
    if [ $? -ne 0 ]; then
        log "Installation failed. Rolling back changes..."
        if [ -d "$BACKUP_DIR" ] && [ -n "$target_dir" ]; then
            rm -rf "$target_dir"
            if [ -d "$BACKUP_DIR" ]; then
                cp -r "$BACKUP_DIR"/* "$(dirname "$target_dir")"
            fi
        fi
    fi
}

trap cleanup EXIT

show_help() {
    echo "Usage: $0 [OPTION]"
    echo "Options:"
    echo "  --help        Show this help message"
    echo "  --uninstall   Remove the plugin"
    echo "Note: Installation requires sudo privileges for system-wide installation."
}

check_requirements() {
    local missing_deps=()
    
    # Check for required commands
    for cmd in npm curl grep; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        error "Missing required dependencies: ${missing_deps[*]}"
    fi

    # Check npm version
    local npm_version
    npm_version=$(npm --version)
    if ! printf '%s\n%s\n' "$MIN_NPM_VERSION" "$npm_version" | sort -V -C; then
        error "npm version $npm_version is less than required version $MIN_NPM_VERSION"
    fi
}

backup_existing() {
    if [ -d "$target_dir" ]; then
        log "Creating backup of existing installation..."
        mkdir -p "$BACKUP_DIR"
        cp -r "$target_dir"/* "$BACKUP_DIR/" || error "Failed to create backup"
    fi
}

install_dependencies() {
    log "Installing npm dependencies..."
    cd "$PLUGIN_SRC_DIR" || error "Failed to change to plugin directory"
    npm install --production || error "npm install failed"
}

uninstall_plugin() {
    if [ -d "$target_dir" ]; then
        log "Uninstalling plugin..."
        rm -rf "$target_dir"
        log "Plugin uninstalled successfully"
    else
        error "Plugin not found in $target_dir"
    fi
    exit 0
}

install_plugin() {
    log "Creating directories..."
    for dir in "resources/img" "resources/store/icons" "resources/store/screenshots" \
               "translations" "scripts" "vendor/google"; do
        mkdir -p "$target_dir/$dir"
    done
    
    log "Copying files..."
    # Copy resource files
    for resource in "img" "store/icons" "store/screenshots"; do
        cp -r "$PLUGIN_SRC_DIR/resources/$resource/"* "$target_dir/resources/$resource/" || \
            log "Warning: Failed to copy $resource"
    done
    
    # Copy other directories
    cp -r "$PLUGIN_SRC_DIR/translations/"* "$target_dir/translations/" || log "Warning: Failed to copy translations"
    cp -r "$PLUGIN_SRC_DIR/scripts/"* "$target_dir/scripts/" || log "Warning: Failed to copy scripts"
    
    # Copy core files
    for file in "config.json" "index.html" "index_widget.html"; do
        cp "$PLUGIN_SRC_DIR/$file" "$target_dir/" || error "Failed to copy $file"
    done
    
    # Copy node_modules if they exist
    if [ -d "$NODE_MODULES_DIR" ]; then
        log "Copying npm dependencies..."
        cp -r "$NODE_MODULES_DIR" "$target_dir/"
    fi

    # Set permissions
    log "Setting permissions..."
    chmod -R 755 "$target_dir"

    verify_installation
}

verify_installation() {
    log "Verifying installation..."
    local critical_files=(
        "config.json"
        "index.html"
        "index_widget.html"
        "resources/img/icon.png"
        "scripts/translate.js"
        "translations/langs.json"
    )
    
    local missing_files=0
    for file in "${critical_files[@]}"; do
        if [ ! -f "$target_dir/$file" ]; then
            log "Warning: Missing critical file: $file"
            ((missing_files++))
        fi
    done

    if [ $missing_files -eq 0 ]; then
        log "Successfully installed $PLUGIN_NAME plugin"
    else
        error "Installation failed: $missing_files critical files missing"
    fi
}

verify_ollama() {
    log "Checking Ollama installation..."
    if ! curl -s http://localhost:11434/api/tags > /dev/null; then
        log "Warning: Could not connect to Ollama at http://localhost:11434"
        log "Please ensure Ollama is installed and running before using the plugin"
    else
        log "Ollama connection verified"
    fi
}

# Main installation logic
case "$1" in
    --help)
        show_help
        exit 0
        ;;
    --uninstall)
        uninstall_plugin
        ;;
    "")
        ;;
    *)
        error "Unknown option: $1. Use --help for usage information."
        ;;
esac

if [ "$(id -u)" != "0" ]; then
    error "Installation requires root privileges. Please run with sudo."
fi

PLUGIN_GUID=$(grep -oP '"guid":\s*"asc\.\K[^"]+' "$PLUGIN_SRC_DIR/config.json") || \
    error "Could not find plugin GUID in config.json"

target_dir="/opt/onlyoffice/desktopeditors/editors/sdkjs-plugins/$PLUGIN_GUID"

# Start installation
log "Starting installation of $PLUGIN_NAME..."

check_requirements
backup_existing
install_dependencies
mkdir -p "$target_dir"
install_plugin
verify_ollama

log "Installation completed successfully!"
