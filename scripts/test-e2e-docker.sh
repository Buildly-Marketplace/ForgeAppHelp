#!/usr/bin/env bash
#
# scripts/test-e2e-docker.sh
# Run Robot Framework E2E tests using Docker (recommended, CI default)
#
# This script:
# 1. Builds and starts the app container
# 2. Runs smoke tests in the e2e container
# 3. Outputs results to artifacts/robot/
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

log_info() { echo -e "${BLUE}[test-e2e]${NC} $1"; }
log_success() { echo -e "${GREEN}[test-e2e]${NC} $1"; }
log_error() { echo -e "${RED}[test-e2e]${NC} $1" >&2; }

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
mkdir -p "$REPO_ROOT/artifacts/robot"

log_info "Starting E2E tests with Docker..."
log_info "Compose command: $COMPOSE_CMD"

cd "$OPS_DIR"

# Start app container (build if needed)
log_info "Building and starting app container..."
$COMPOSE_CMD up -d --build app

# Wait for app to be healthy
log_info "Waiting for app to be healthy..."
$COMPOSE_CMD up --wait app

# Run smoke tests
log_info "Running Robot Framework smoke tests..."
$COMPOSE_CMD run --rm \
    -e BASE_URL=http://app:8000 \
    e2e \
    robot \
    --outputdir /work/artifacts/robot \
    --log smoke-log.html \
    --report smoke-report.html \
    --output smoke-output.xml \
    /work/tests/robot/smoke.robot

TEST_EXIT_CODE=$?

# Show results location
if [[ $TEST_EXIT_CODE -eq 0 ]]; then
    log_success "All tests passed!"
else
    log_error "Some tests failed (exit code: $TEST_EXIT_CODE)"
fi

log_info "Results available in: artifacts/robot/"
log_info "  - smoke-report.html"
log_info "  - smoke-log.html"
log_info "  - smoke-output.xml"

# Keep app running for inspection if tests failed, otherwise stop
if [[ $TEST_EXIT_CODE -ne 0 ]]; then
    log_info "App container left running for debugging. Stop with: ./ops/startup.sh stop docker"
else
    log_info "Stopping containers..."
    $COMPOSE_CMD down
fi

exit $TEST_EXIT_CODE
