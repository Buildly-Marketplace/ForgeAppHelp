# ForgeAppHelp

Drop-in issue reporting and in-app help that files to [Buildly Labs](https://labs.buildly.io),
with logs, breadcrumbs and crash context already attached.

Extracted from a production React Native app after four days of chasing a crash
that reported nothing. Most of what is here is the result of that: the ordering
in the storage adapter, the fatal/non-fatal split in the global handler, and the
breadcrumbs that survive a process abort are all load-bearing, and the comments
say why.

Built on [ForgeFETemplate](https://github.com/Buildly-Marketplace/ForgeFETemplate).

---

## What it does

- **A help form** your users can open from anywhere, in their language or yours
- **Automatic context** — the last 500 console lines, every network call
  (method, redacted URL, status, duration), device, locale, build number
- **Breadcrumbs that survive a crash** — errors are mirrored to storage as they
  happen, so the next launch can describe a session that died
- **A global error handler that does not make things worse** — see below
- **Screenshots**, within the size budget Labs' API allows

Bodies are never logged, and query-string values are redacted before a URL is
recorded. API keys and OAuth tokens routinely ride in query strings, and a
report is read by whoever picks up the ticket.

---

## Install

```bash
npm install @buildly/forge-app-help
```

React is an optional peer dependency: the core has no framework dependency at
all, so a Node script or a worker can file reports without pulling React in.

---

## React (web)

```tsx
import { HelpProvider, HelpForm, ErrorBoundary } from '@buildly/forge-app-help/react';

function App() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <HelpProvider
      config={{
        productId: import.meta.env.VITE_LABS_PRODUCT_ID,
        apiKey: import.meta.env.VITE_LABS_API_KEY,
        appVersion: __APP_VERSION__,
        buildNumber: __BUILD_NUMBER__,
      }}
    >
      <ErrorBoundary>
        <YourApp onHelp={() => setHelpOpen(true)} />
        <HelpForm open={helpOpen} onClose={() => setHelpOpen(false)} />
      </ErrorBoundary>
    </HelpProvider>
  );
}
```

`HelpProvider` patches console, fetch and the global error handler on mount and
restores all three on unmount.

### Theming

The form takes a `theme`, so it inherits your palette instead of imposing one:

```tsx
<HelpForm
  open={open}
  onClose={close}
  baseTheme={darkTheme}
  theme={{ accent: '#0B8E7C', radius: 16 }}
/>
```

### Audience

`audience="end-user"` swaps the engineering vocabulary for plain language and
hides the severity picker. A customer reporting a late delivery should not have
to choose between "performance" and "ui-ux". Both audiences land in the same
Labs punchlist, tagged so triage can tell them apart.

---

## React Native

The provider, hooks and core are shared. Two things differ.

**Supply the adapters**, so the package never imports `react-native` itself:

```tsx
import { Platform, Dimensions, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HelpProvider,
  ReactNativeStorageAdapter,
  ReactNativePlatformAdapter,
} from '@buildly/forge-app-help/react-native';

const adapters = {
  storage: new ReactNativeStorageAdapter(AsyncStorage),
  platform: new ReactNativePlatformAdapter({
    os: Platform.OS,
    dimensions: Dimensions,
    colorScheme: () => Appearance.getColorScheme(),
  }),
};

<HelpProvider config={config} adapters={adapters} onFatal={persistCrash}>
  {children}
</HelpProvider>
```

**Bring your own form.** There is no native `HelpForm` here on purpose: a
generic one looks foreign in every app. Call `useReporter().reportIssue(...)`
from your own screen, using your design system, keyboard handling and
navigation.

Read the build number from the binary, never a constant:

```tsx
import * as Application from 'expo-application';

reporter.setAppVersion(
  Application.nativeApplicationVersion ?? '1.0.0',
  Application.nativeBuildVersion ?? 'unknown'
);
```

Pinned values are worse than none. When every report claims the same build, a
stale install is indistinguishable from a real regression.

---

## Why the global handler is shaped the way it is

React Native's default error handler calls
`NativeExceptionsManager.reportException`, which reaches `RCTFatal` and aborts
the process — **even for an error the runtime did not flag fatal**. A wrapper
that forwards everything to it turns a rejected haptic, a failed prefetch or an
analytics timeout into a hard crash.

So non-fatal errors stop at the breadcrumb. Only genuinely fatal ones reach the
default handler. `tests/unit/capture.test.ts` pins this down.

Two more consequences worth knowing:

- **`onFatal` must persist synchronously.** On iOS the process aborts on the
  same tick, so a POST started there is killed with it. Write to storage, and
  send on the next launch.
- **The storage adapter must not read before writing.** The version that did
  lost every fatal error, because the round trip never completed. That is why
  `ReactNativeStorageAdapter.setItem` deliberately does not await.

An `ErrorBoundary` alone is not enough either: it catches render and lifecycle
errors, never rejections from event handlers. The two mechanisms are
complementary.

---

## Core API, without React

```ts
import { IssueReporter } from '@buildly/forge-app-help';

const reporter = new IssueReporter({ productId, apiKey });
reporter.start();

await reporter.reportIssue({
  title: 'Checkout fails on the payment step',
  description: 'Card is accepted, then the screen returns to the cart.',
  severity: 'high',
  category: 'bug',
  contactEmail: 'user@example.com',
});
```

| Method | Purpose |
|--------|---------|
| `start(onFatal?)` / `stop()` | Install and remove the capture hooks |
| `reportIssue(report)` | File an issue, with debug data attached |
| `reportPunchlistItem(item)` | File to the punchlist |
| `reportTask(item)` | File a task |
| `log(level, category, ...args)` | Add a breadcrumb by hand |
| `logError(category, error, extra?)` | Record an error with its stack |
| `loadPreviousSessionBreadcrumbs()` | Recover a dead session's final errors |
| `setCredentials` / `setAppVersion` | Update either after mount |
| `getLogs` / `exportLogsAsJSON` / `exportLogsAsCSV` | Read the buffer |

Every submit resolves to `{ success, issueId?, error? }` — none of them throw,
because a diagnostics library must never be the thing that breaks the host.

### Privacy

`includeDebugData: false` means the logs and device context are **not
assembled at all**, rather than sent behind a flag. The help form exposes this
as a checkbox.

### Endpoints

Defaults point at `https://labs.buildly.io/api/v1/*`. Override per environment:

```ts
new IssueReporter({
  productId,
  apiKey,
  endpoints: { issues: 'https://labs.internal/api/v1/issues' },
});
```

An endpoint returning 404 degrades to a clear message rather than a user-facing
failure — not every Labs deployment exposes every one.

---

## Development

```bash
npm install
npm test          # 55 unit tests
npm run typecheck
npm run lint
npm run dev       # demo app on :8000
```

`./ops/startup.sh start node` runs the demo through the standard Forge control
script; `./scripts/test-e2e-docker.sh` runs the Robot Framework suite against
the built demo. See [devdocs/04_testing.md](devdocs/04_testing.md).

---

## Using it as a submodule

```bash
git submodule add https://github.com/Buildly-Marketplace/ForgeAppHelp.git vendor/forge-app-help
npm install ./vendor/forge-app-help
```

The package builds itself on install via `prepublishOnly`/`prepare`, so a
consuming app gets `dist/` without committing it here.

---

## License

MIT — see [LICENSE](LICENSE).
