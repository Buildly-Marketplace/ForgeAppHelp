import { useState } from 'react';
import { HelpProvider, HelpForm, ErrorBoundary, useReporter } from '../src/react';
import { darkTheme } from '../src/core/theme';

/**
 * Demo host for the help component, and the marketplace's required UI hooks.
 *
 * `app-root`, `primary-action` and `panel` are declared in BUILDLY.yaml and
 * asserted by both the unit tests and the Robot suites -- see README.
 */
function DemoInner() {
  const [helpOpen, setHelpOpen] = useState(false);
  const reporter = useReporter();

  return (
    <main className="demo" data-testid="app-root">
      <header>
        <h1>ForgeAppHelp</h1>
        <p className="muted">
          Issue reporting and in-app help that files to Buildly Labs, with logs,
          breadcrumbs and crash context attached.
        </p>
      </header>

      <button
        type="button"
        className="demo__action"
        data-testid="primary-action"
        onClick={() => setHelpOpen(true)}
      >
        Report an issue
      </button>

      {helpOpen && (
        <section className="demo__panel" data-testid="panel">
          <HelpForm
            open={helpOpen}
            onClose={() => setHelpOpen(false)}
            audience="internal"
            baseTheme={darkTheme}
          />
          <p className="muted">
            The form is open. Without real Labs credentials the submit will fail
            with a configuration error -- which is itself the reporter working.
          </p>
        </section>
      )}

      <section className="demo__logs">
        <h2>Captured this session</h2>
        <p className="muted">
          {reporter.getLogs().length} log entries. Console output, network calls
          and unhandled errors are captured automatically and ride along with a
          report.
        </p>
        <button
          type="button"
          className="demo__secondary"
          onClick={() => console.error('Demo: a deliberate console error')}
        >
          Log an error
        </button>
      </section>
    </main>
  );
}

export default function Demo() {
  return (
    <HelpProvider
      config={{
        // Demo credentials. A real host reads these from its own environment.
        productId: import.meta.env.VITE_LABS_PRODUCT_ID ?? '',
        apiKey: import.meta.env.VITE_LABS_API_KEY ?? '',
        appVersion: '1.0.0',
        buildNumber: 'demo',
        isTestMode: true,
      }}
    >
      <ErrorBoundary>
        <DemoInner />
      </ErrorBoundary>
    </HelpProvider>
  );
}
