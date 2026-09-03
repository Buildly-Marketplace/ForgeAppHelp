#!/usr/bin/env bash
#
# ops/startup.sh - Single entrypoint for ForgeAppHelp app control
#
# Usage: ./ops/startup.sh <start|stop|restart|status|help> <node|docker> [--port PORT]
#
# This script manages the ForgeAppHelp dev server in both node and Docker modes.
# The node mode runs whatever "npm run dev" is wired to, so the same contract
# works for React, React Native web, Angular, Vue or anything else.
# It auto-selects an available port in the range 8000-9000 if no port is specified.
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT_FILE="$REPO_ROOT/.forge-port"
PID_FILE="$REPO_ROOT/.forge-node.pid"
LOG_FILE="$REPO_ROOT/.forge-node.log"
PORT_MIN=8000
PORT_MAX=9000
DEFAULT_PORT=8000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Utility functions
# -----------------------------------------------------------------------------

log_info() {
    echo -e "${BLUE}[forge]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[forge]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[forge]${NC} $1"
}

log_error() {
    echo -e "${RED}[forge]${NC} $1" >&2
}

# Check if a port is free
# Returns 0 if free, 1 if in use
is_port_free() {
    local port=$1
    
    # Try lsof first (macOS and most Linux)
    if command -v lsof &>/dev/null; then
        if lsof -i ":$port" &>/dev/null; then
            return 1  # Port is in use
        fi
        return 0  # Port is free
    fi
    
    # Fallback: a node bind check, so this script needs no Python at all.
    if command -v node &>/dev/null; then
        if node -e "
const net = require('net');
const srv = net.createServer();
srv.once('error', () => process.exit(1));
srv.once('listening', () => srv.close(() => process.exit(0)));
srv.listen($port, '127.0.0.1');
" 2>/dev/null; then
            return 0  # Port is free
        fi
        return 1  # Port is in use
    fi
    return 0  # Cannot check -- assume free
}

# Find first available port in range
find_free_port() {
    local port
    for ((port = PORT_MIN; port <= PORT_MAX; port++)); do
        if is_port_free "$port"; then
            echo "$port"
            return 0
        fi
    done
    return 1
}

# Get stored port or find a new one
get_or_find_port() {
    local requested_port=$1
    
    if [[ -n "$requested_port" ]]; then
        # User requested a specific port
        if is_port_free "$requested_port"; then
            echo "$requested_port"
            return 0
        else
            log_error "Port $requested_port is already in use"
            return 1
        fi
    fi
    
    # Check if we have a stored port that's still free
    if [[ -f "$PORT_FILE" ]]; then
        local stored_port
        stored_port=$(cat "$PORT_FILE")
        if is_port_free "$stored_port"; then
            echo "$stored_port"
            return 0
        fi
        log_warn "Previously used port $stored_port is now in use, finding new port..."
    fi
    
    # Find a new free port
    local new_port
    new_port=$(find_free_port)
    if [[ -z "$new_port" ]]; then
        log_error "No free port found in range $PORT_MIN-$PORT_MAX"
        return 1
    fi
    echo "$new_port"
}

save_port() {
    echo "$1" > "$PORT_FILE"
}

get_saved_port() {
    if [[ -f "$PORT_FILE" ]]; then
        cat "$PORT_FILE"
    else
        echo "$DEFAULT_PORT"
    fi
}

# Detect docker compose command (v2 vs v1)
get_docker_compose_cmd() {
    if docker compose version &>/dev/null 2>&1; then
        echo "docker compose"
    elif command -v docker-compose &>/dev/null; then
        echo "docker-compose"
    else
        log_error "Docker Compose not found. Install Docker Desktop or docker-compose."
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Node mode functions
# -----------------------------------------------------------------------------

node_is_running() {
    if [[ -f "$PID_FILE" ]]; then
        local pid
        pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

node_start() {
    local port=$1
    
    if node_is_running; then
        local pid=$(cat "$PID_FILE")
        local saved_port=$(get_saved_port)
        log_warn "Server already running (PID: $pid) on port $saved_port"
        log_info "URL: http://localhost:$saved_port"
        return 0
    fi
    
    # Resolve port
    port=$(get_or_find_port "$port") || return 1
    save_port "$port"
    
    log_info "Starting dev server on port $port..."

    cd "$REPO_ROOT"
    if [ ! -d node_modules ]; then
        log_info "Installing dependencies (first run)..."
        npm ci --silent 2>&1 | tail -3 || npm install --silent 2>&1 | tail -3
    fi
    # PORT is exported as well as passed on the command line: Vite takes
    # --port, CRA and Angular read the env var. Covering both means this
    # script never needs to know which framework the app uses.
    PORT="$port" nohup npm run dev -- --port "$port" </dev/null > "$LOG_FILE" 2>&1 &
    local pid=$!
    echo "$pid" > "$PID_FILE"
    disown "$pid" 2>/dev/null || true
    
    # Wait briefly and verify it responds before reporting success
    local count=0
    while [[ $count -lt 10 ]]; do
        if curl -s "http://localhost:$port" &>/dev/null; then
            break
        fi
        sleep 0.5
        ((count++))
    done

    if kill -0 "$pid" 2>/dev/null && curl -s "http://localhost:$port" &>/dev/null; then
        log_success "Server started successfully"
        log_info "PID: $pid"
        log_info "URL: http://localhost:$port"
        log_info "Log: $LOG_FILE"
    else
        log_error "Server failed to start"
        log_info "Check log: $LOG_FILE"
        rm -f "$PID_FILE"
        return 1
    fi
}

node_stop() {
    if ! node_is_running; then
        log_info "Server is not running"
        rm -f "$PID_FILE"
        return 0
    fi
    
    local pid=$(cat "$PID_FILE")
    log_info "Stopping server (PID: $pid)..."
    
    kill "$pid" 2>/dev/null || true
    
    # Wait for process to stop
    local count=0
    while kill -0 "$pid" 2>/dev/null && [[ $count -lt 10 ]]; do
        sleep 0.5
        ((count++))
    done
    
    if kill -0 "$pid" 2>/dev/null; then
        log_warn "Process didn't stop gracefully, forcing..."
        kill -9 "$pid" 2>/dev/null || true
    fi
    
    rm -f "$PID_FILE"
    log_success "Server stopped"
}

node_restart() {
    local port=$1
    node_stop
    node_start "$port"
}

node_status() {
    if node_is_running; then
        local pid=$(cat "$PID_FILE")
        local port=$(get_saved_port)
        log_success "Server is running"
        log_info "PID: $pid"
        log_info "Port: $port"
        log_info "URL: http://localhost:$port"
        log_info "Log: $LOG_FILE"
    else
        log_info "Server is not running"
        rm -f "$PID_FILE" 2>/dev/null || true
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Docker mode functions
# -----------------------------------------------------------------------------

docker_is_running() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd) || return 1
    
    cd "$SCRIPT_DIR"
    local status
    status=$($compose_cmd ps --format json 2>/dev/null | grep -o '"State":"running"' || true)
    [[ -n "$status" ]]
}

docker_start() {
    local port=$1
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd) || return 1
    
    # Resolve port
    port=$(get_or_find_port "$port") || return 1
    save_port "$port"
    
    log_info "Starting Docker containers on port $port..."
    
    cd "$SCRIPT_DIR"
    FORGE_PORT="$port" $compose_cmd up -d --build app
    
    log_success "Docker containers started"
    log_info "Port: $port"
    log_info "URL: http://localhost:$port"
    
    # Wait for health
    log_info "Waiting for app to be healthy..."
    local count=0
    while [[ $count -lt 30 ]]; do
        if curl -s "http://localhost:$port" &>/dev/null; then
            log_success "App is healthy and ready"
            return 0
        fi
        sleep 1
        ((count++))
    done
    log_warn "App may not be fully ready yet, check manually"
}

docker_stop() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd) || return 1
    
    log_info "Stopping Docker containers..."
    
    cd "$SCRIPT_DIR"
    $compose_cmd down
    
    log_success "Docker containers stopped"
}

docker_restart() {
    local port=$1
    docker_stop
    docker_start "$port"
}

docker_status() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd) || return 1
    
    cd "$SCRIPT_DIR"
    
    if docker_is_running; then
        local port=$(get_saved_port)
        log_success "Docker app is running"
        log_info "Port: $port"
        log_info "URL: http://localhost:$port"
        echo ""
        $compose_cmd ps
    else
        log_info "Docker app is not running"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Help
# -----------------------------------------------------------------------------

show_help() {
    cat << 'EOF'
ForgeAppHelp Control Script

USAGE:
    ./ops/startup.sh <command> <mode> [options]

COMMANDS:
    start       Start the application server
    stop        Stop the application server
    restart     Restart the application server
    status      Show the current status
    help        Show this help message

MODES:
    node        Run the dev server via npm (faster, requires Node 20+)
    docker      Run using Docker containers (recommended, reproducible)

OPTIONS:
    --port PORT    Specify a port to use (default: auto-select from 8000-9000)

EXAMPLES:
    # Start with Docker (recommended)
    ./ops/startup.sh start docker

    # Start with node on a specific port
    ./ops/startup.sh start node --port 8080

    # Check status
    ./ops/startup.sh status docker
    ./ops/startup.sh status node

    # Stop the server
    ./ops/startup.sh stop node

STATE FILES:
    .forge-port         Stores the last used port
    .forge-node.pid     Stores the dev server PID
    .forge-node.log     Stores dev server output

NOTES:
    - Docker mode requires Docker Desktop or Docker Engine with Compose
    - node mode requires Node 20+ and an npm "dev" script
    - Port auto-selection finds the first free port in range 8000-9000
    - On restart, the same port is reused if still available

EOF
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    local command=""
    local mode=""
    local port=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            start|stop|restart|status|help)
                command="$1"
                ;;
            node|docker)
                mode="$1"
                ;;
            --port)
                shift
                port="$1"
                ;;
            -h|--help)
                command="help"
                ;;
            *)
                log_error "Unknown argument: $1"
                echo "Run './ops/startup.sh help' for usage"
                exit 1
                ;;
        esac
        shift
    done
    
    # Handle help command
    if [[ "$command" == "help" ]] || [[ -z "$command" ]]; then
        show_help
        exit 0
    fi
    
    # Validate mode
    if [[ -z "$mode" ]]; then
        log_error "Mode required: node or docker"
        echo "Run './ops/startup.sh help' for usage"
        exit 1
    fi
    
    # Execute command
    case "$mode" in
        node)
            case "$command" in
                start)   node_start "$port" ;;
                stop)    node_stop ;;
                restart) node_restart "$port" ;;
                status)  node_status ;;
            esac
            ;;
        docker)
            case "$command" in
                start)   docker_start "$port" ;;
                stop)    docker_stop ;;
                restart) docker_restart "$port" ;;
                status)  docker_status ;;
            esac
            ;;
    esac
}

main "$@"
