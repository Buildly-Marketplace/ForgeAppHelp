# Testing Guide

This document explains the testing strategy for ForgeAppHelp and Buildly Marketplace frontend submissions.

## Overview

Testing happens at two levels:

| Level | Tool | Runs in | Asserts |
|-------|------|---------|---------|
| **Unit / component** | Vitest + Testing Library | milliseconds, no browser | Component behaviour and the `data-testid` contract |
| **E2E** | Robot Framework Browser (Playwright) | a real Chromium, against the built app | The app actually works end to end |

Robot Framework and Playwright are Python tools, but they only drive the
**test runner**. Your application is pure JavaScript and never imports them --
and the Docker path removes the local Python requirement entirely.

Two E2E modes are available:

| Mode | Recommended For | Pros | Cons |
|------|-----------------|------|------|
| **Docker-first** | CI, reproducibility | Zero local deps, matches CI exactly, tests the real production build | Slower startup, requires Docker |
| **Node-first** | Fast local dev | Fastest iteration, direct debugging, hot reload | Needs local Python for the runner; tests the dev server, not the build |

---

## Unit / Component Tests

The fastest layer, and the one to reach for first.

```bash
npm test            # single run
npm run test:watch  # re-run on save
```

These live in `tests/unit/` and assert on the same `data-testid` hooks the
Robot suite uses. That overlap is deliberate: renaming a hook fails a unit test
in under a second instead of failing marketplace CI after a full Docker build.

## Docker-first Mode (Recommended)

### When to Use
- **CI/CD pipelines** (always)
- **First-time setup** (no local deps needed)
- **Reproducing CI failures**
- **Generating final screenshots**

### Prerequisites
- Docker Desktop or Docker Engine with Compose

### Running Tests

```bash
# Run E2E smoke tests
./scripts/test-e2e-docker.sh

# Generate marketplace screenshots
./scripts/screenshots-docker.sh
```

### How It Works
1. Builds the app container (`ops/Dockerfile.app`) -- runs `npm run build`, then serves the output with nginx
2. Builds the e2e container (`ops/Dockerfile.e2e`) with Robot Framework + Playwright
3. Starts app container, waits for health check
4. Runs Robot tests in e2e container against app container
5. Outputs reports to `artifacts/robot/`
6. Screenshots go to `marketplace/screenshots/`

### Advantages
- **Reproducible**: Same environment locally and in CI
- **No local deps**: Only Docker required
- **Isolated**: Doesn't pollute your system

### Disadvantages
- **Slower**: Container build time on first run
- **Resource heavy**: Runs full containers
- **Debugging**: Harder to inspect test failures interactively

---

## Node-first Mode (Optional)

### When to Use
- **Fast iteration** during development
- **Debugging tests** with local tools
- **Quick smoke tests** while coding

### Prerequisites
- Node 20+ and npm 10+ (to run the app)
- Python 3.10+ (for the Robot/Playwright **runner** only)
- System dependencies for Playwright (usually auto-installed)

### Setup

```bash
# Start the dev server (installs node_modules on first run)
./ops/startup.sh start node

# Run tests (creates a venv for the runner, installs deps automatically)
./scripts/test-e2e-node.sh

# Generate screenshots
./scripts/screenshots-node.sh

# Stop when done
./ops/startup.sh stop node
```

### How It Works
1. Creates `.venv/` for the test runner if needed
2. Installs Robot Framework + Browser library
3. Runs `rfbrowser init` to install Playwright browsers
4. Runs tests against the local dev server

### Advantages
- **Fastest**: No container overhead
- **Direct debugging**: Use local tools, add breakpoints
- **Quick feedback**: Instant test reruns

### Disadvantages
- **May drift**: Local env might differ from CI
- **System deps**: May need manual Playwright deps on some systems
- **Not reproducible**: Works on your machine ≠ works everywhere
- **Not the shipped artifact**: This hits the dev server. Minification, asset
  hashing and the nginx SPA fallback only exist in the Docker path, so run that
  before you trust a green result

---

## Test Files

```
tests/
├── unit/
│   ├── setup.js        # Testing Library matchers
│   └── App.test.jsx    # Component tests for the required UI hooks
└── robot/
    ├── requirements.txt    # Runner dependencies (pinned versions)
    ├── smoke.robot         # Core functionality tests
    └── screenshots.robot   # Screenshot generation for marketplace
```

### smoke.robot
Verifies basic app functionality:
- App root loads correctly
- Primary action button is clickable
- Panel appears after interaction
- Page has a title

### screenshots.robot
Generates canonical marketplace screenshots:
- `01-home.png` - Initial app state
- `02-primary-action.png` - After clicking primary action

---

## Output Locations

| Output | Location | Git |
|--------|----------|-----|
| Robot reports | `artifacts/robot/` | Ignored |
| Screenshots | `marketplace/screenshots/` | Tracked |
| Virtual env (test runner) | `.venv/` | Ignored |
| Build output | `dist/` | Ignored |
| Dependencies | `node_modules/` | Ignored |
| Lockfile | `package-lock.json` | **Tracked** (CI requires it) |

---

## CI Integration

GitHub Actions runs Docker-first tests on every push/PR:

```yaml
# .github/workflows/ci.yml
- run: npm run lint --if-present
- run: npm run build
- run: npm test --if-present
- run: ./scripts/test-e2e-docker.sh
- run: ./scripts/screenshots-docker.sh
```

Results are uploaded as artifacts for inspection.

---

## Troubleshooting

### "App is not running"
Start the app first:
```bash
./ops/startup.sh start node
# or
./ops/startup.sh start docker
```

### "rfbrowser init failed"
On some systems, Playwright needs additional deps:
```bash
# Debian/Ubuntu
sudo apt-get install libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1
```

### "Port already in use"
Check what's using the port:
```bash
lsof -i :8000
```

Use a different port:
```bash
./ops/startup.sh start node --port 8080
```

### Docker tests fail but node tests pass
This usually means a path or environment issue. Check:
- Volume mounts in `docker-compose.yml`
- `BASE_URL` environment variable
- `frontend.build_dir` in `BUILDLY.yaml` matches where `npm run build` actually
  writes -- a wrong `BUILD_DIR` produces an empty nginx image that 404s while
  the dev server works fine

---

## Best Practices

1. **Start with unit tests** - Milliseconds, no browser, catch most regressions
2. **Use Docker-first for CI** - Always match the CI environment
3. **Use node-first for dev** - Fast feedback during development
4. **Run Docker tests before pushing** - Catch CI failures early
5. **Keep tests focused** - Test UI behavior, not implementation
6. **Use data-testid** - Stable selectors that don't break with styling changes
7. **Never delete a required hook** - `app-root`, `primary-action` and `panel`
   are declared in `BUILDLY.yaml`; removing one fails marketplace validation
