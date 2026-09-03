import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { IssueReporter } from '../core/reporter.js';
import type { Adapters } from '../adapters/index.js';
import type { ReporterConfig } from '../core/types.js';

const ReporterContext = createContext<IssueReporter | null>(null);

export interface HelpProviderProps {
  config: ReporterConfig;
  /** Host storage and platform. Defaults to in-memory + universal detection. */
  adapters?: Adapters;
  /**
   * Called on a fatal error before the runtime's default handler.
   *
   * Must persist synchronously -- on iOS the process aborts on the same tick,
   * so anything async started here dies with it.
   */
  onFatal?: (error: Error, isFatal: boolean) => void;
  /** Recover errors persisted by a session that crashed. Default true. */
  loadPreviousSession?: boolean;
  children: ReactNode;
}

/**
 * Creates one reporter for the app and installs its capture hooks.
 *
 * Mount this above anything that might report. It patches console, fetch and
 * the global error handler on mount, and restores all three on unmount.
 */
export function HelpProvider({
  config,
  adapters,
  onFatal,
  loadPreviousSession = true,
  children,
}: HelpProviderProps) {
  // The reporter must outlive re-renders: recreating it would drop the log
  // buffer and re-patch globals on every parent render.
  const reporterRef = useRef<IssueReporter | null>(null);
  if (reporterRef.current === null) {
    reporterRef.current = new IssueReporter(config, adapters);
  }
  const reporter = reporterRef.current;

  useEffect(() => {
    reporter.start(onFatal);
    if (loadPreviousSession) void reporter.loadPreviousSessionBreadcrumbs();
    return () => reporter.stop();
    // Intentionally mount-only. onFatal is read once when handlers install;
    // adding it here would tear down and reinstall global patches whenever a
    // caller passed an inline arrow function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reporter]);

  // Credentials can change after mount (a late-loading config, a user signing
  // in), and that must not cost the accumulated logs.
  useEffect(() => {
    reporter.setCredentials(config.productId, config.apiKey, config.isTestMode);
  }, [reporter, config.productId, config.apiKey, config.isTestMode]);

  useEffect(() => {
    if (config.appVersion || config.buildNumber) {
      reporter.setAppVersion(config.appVersion ?? '1.0.0', config.buildNumber ?? 'unknown');
    }
  }, [reporter, config.appVersion, config.buildNumber]);

  const value = useMemo(() => reporter, [reporter]);

  return <ReporterContext.Provider value={value}>{children}</ReporterContext.Provider>;
}

/**
 * The app's reporter.
 *
 * Throws when used outside a HelpProvider -- a reporter that silently does
 * nothing is worse than one that fails loudly at development time, because
 * the failure only shows up as missing reports much later.
 */
export function useReporter(): IssueReporter {
  const reporter = useContext(ReporterContext);
  if (!reporter) {
    throw new Error('useReporter must be used inside a <HelpProvider>');
  }
  return reporter;
}

/** Non-throwing variant, for code that may render outside the provider. */
export function useOptionalReporter(): IssueReporter | null {
  return useContext(ReporterContext);
}
