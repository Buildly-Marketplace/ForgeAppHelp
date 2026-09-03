#!/usr/bin/env bash
#
# scripts/test-e2e-node.sh
# Run Robot Framework E2E tests against a locally-running dev server.
#
# Prerequisites:
#   1. The app is running: ./ops/startup.sh start node
#   2. Python 3.x is available -- for the TEST RUNNER only. Robot Framework and
#      Playwright are Python tools; the application under test is pure
#      JavaScript and never sees them. Use the Docker path
#      (./scripts/test-e2e-docker.sh) if you would rather not install them.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV_DIR="$REPO_ROOT/.venv"
PORT_FILE="$REPO_ROOT/.forge-port"
REQUIREMENTS="$REPO_ROOT/tests/robot/requirements.txt"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[test-e2e]${NC} $1"; }
log_success() { echo -e "${GREEN}[test-e2e]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[test-e2e]${NC} $1"; }
log_error() { echo -e "${RED}[test-e2e]${NC} $1" >&2; }

if [[ -f "$PORT_FILE" ]]; then
    PORT=$(cat "$PORT_FILE")
else
    PORT=8000
fi

BASE_URL="http://localhost:$PORT"

log_info "Checking if app is running at $BASE_URL..."
if ! curl -s "$BASE_URL" &>/dev/null; then
    log_error "App is not running at $BASE_URL"
    log_info "Start it with: ./ops/startup.sh start node"
    exit 1
fi
log_success "App is running"

if [[ ! -d "$VENV_DIR" ]]; then
    log_info "Creating virtual environment for the test runner..."
    python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

log_info "Installing Robot Framework dependencies..."
pip install -q -r "$REQUIREMENTS"

log_info "Initializing Playwright browsers..."
rfbrowser init 2>/dev/null || {
    log_warn "Browser init had warnings (may be already initialized)"
}

mkdir -p "$REPO_ROOT/artifacts/robot"

log_info "Running smoke tests against $BASE_URL..."
cd "$REPO_ROOT"

robot \
    --outputdir artifacts/robot \
    --log smoke-log.html \
    --report smoke-report.html \
    --output smoke-output.xml \
    --variable BASE_URL:$BASE_URL \
    tests/robot/smoke.robot

TEST_EXIT_CODE=$?

if [[ $TEST_EXIT_CODE -eq 0 ]]; then
    log_success "All tests passed!"
else
    log_error "Some tests failed (exit code: $TEST_EXIT_CODE)"
fi

log_info "Results available in: artifacts/robot/"

exit $TEST_EXIT_CODE
