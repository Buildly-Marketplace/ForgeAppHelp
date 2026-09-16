import { defaultAdapters, type Adapters } from '../adapters/index.js';
import { IssueReporter } from '../core/reporter.js';
import type { ReporterConfig } from '../core/types.js';

/**
 * Creates and starts a reporter for a framework-free app.
 *
 * There is no component tree here to own the instance the way `HelpProvider`
 * does for React, so the host is responsible for holding onto the return
 * value itself -- typically a single module-level variable set once at
 * startup. Call this once per app: calling it again drops the current log
 * buffer and re-patches `console`/`fetch`/the global error handler, the same
 * cost `HelpProvider` avoids by creating its reporter exactly once via a
 * ref.
 *
 * `onFatal` must persist synchronously -- on iOS or in a browser tab that is
 * about to reload, anything async started here may never complete.
 */
export function createHelpClient(
  config: ReporterConfig,
  adapters: Adapters = defaultAdapters(),
  onFatal?: (error: Error, isFatal: boolean) => void
): IssueReporter {
  const reporter = new IssueReporter(config, adapters);
  reporter.start(onFatal);
  return reporter;
}

/** Restores every global `createHelpClient` patched. */
export function stopHelpClient(reporter: IssueReporter): void {
  reporter.stop();
}
