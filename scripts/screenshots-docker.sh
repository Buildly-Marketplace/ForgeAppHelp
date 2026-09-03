#!/usr/bin/env bash
#
# scripts/screenshots-docker.sh
# Generate canonical marketplace screenshots using Docker
#
# This script:
# 1. Builds and starts the app container
# 2. Runs screenshots.robot in the e2e container
# 3. Outputs screenshots to marketplace/screenshots/
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPS_DIR="$REPO_ROOT/ops"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[screenshots]${NC} $1"; }
log_success() { echo -e "${GREEN}[screenshots]${NC} $1"; }
log_error() { echo -e "${RED}[screenshots]${NC} $1" >&2; }

# Detect docker compose command
get_docker_compose_cmd() {
    if docker compose version &>/dev/null 2>&1; then
        echo "docker compose"
    elif command -v docker-compose &>/dev/null; then
        echo "docker-compose"
    else
        log_error "Docker Compose not found"
        exit 1
    fi
}

COMPOSE_CMD=$(get_docker_compose_cmd)

# Ensure output directories exist
mkdir -p "$REPO_ROOT/marketplace/screenshots"
mkdir -p "$REPO_ROOT/artifacts/robot"

log_info "Generating marketplace screenshots with Docker..."

cd "$OPS_DIR"

# Start app container
log_info "Building and starting app container..."
$COMPOSE_CMD up -d --build app

# Wait for app to be healthy
log_info "Waiting for app to be healthy..."
$COMPOSE_CMD up --wait app

# Run screenshot tests
log_info "Running screenshot generation..."
$COMPOSE_CMD run --rm \
    -e BASE_URL=http://app:8000 \
    -e SCREENSHOT_DIR=/work/marketplace/screenshots \
    e2e \
    robot \
    --outputdir /work/artifacts/robot \
    --log screenshots-log.html \
    --report screenshots-report.html \
    --output screenshots-output.xml \
    --variable SCREENSHOT_DIR:/work/marketplace/screenshots \
    /work/tests/robot/screenshots.robot

EXIT_CODE=$?

# Stop containers
log_info "Stopping containers..."
$COMPOSE_CMD down

if [[ $EXIT_CODE -eq 0 ]]; then
    log_success "Screenshots generated successfully!"
    log_info "Screenshots available in: marketplace/screenshots/"
    ls -la "$REPO_ROOT/marketplace/screenshots/"
else
    log_error "Screenshot generation failed (exit code: $EXIT_CODE)"
fi

exit $EXIT_CODE
