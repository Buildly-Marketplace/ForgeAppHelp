import type { LogBuffer } from './logger.js';

export type Teardown = () => void;

/**
 * Mirrors console.error and console.warn into the log buffer.
 *
 * Returns a teardown that restores the originals -- the Inflately version
 * patched the console permanently, which made it impossible to unmount the
 * reporter or to run two tests in a row cleanly.
 */
export function captureConsole(buffer: LogBuffer): Teardown {
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    buffer.add('error', 'console-error', ...args);
    originalError.apply(console, args as []);
  };

  console.warn = (...args: unknown[]) => {
    buffer.add('warn', 'console-warn', ...args);
    originalWarn.apply(console, args as []);
  };

  return () => {
    console.error = originalError;
    console.warn = originalWarn;
  };
}

/**
 * Replaces every query-string value with [redacted].
 *
 * API keys and OAuth tokens routinely ride in the query string (?key=... on
 * Google's REST APIs, for one), and a debug report is read by whoever picks up
 * the ticket.
 */
export function redactUrl(input: string): string {
  try {
    const base = typeof location !== 'undefined' ? location.href : undefined;
    const url = new URL(input, base);
    for (const key of url.searchParams.keys()) {
      url.searchParams.set(key, '[redacted]');
    }
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    // A relative or malformed URL that new URL() cannot parse. Log it as-is
    // rather than dropping the entry; these do not carry a query string.
    return input;
  }
}

/**
 * Wraps global fetch so every request shows up in a submitted report.
 *
 * Logs method, redacted URL, status and duration. Never the request or
 * response body: those carry user PII and secrets, and a report is not a
 * private channel.
 */
export function captureNetwork(buffer: LogBuffer): Teardown {
  if (typeof fetch !== 'function') return () => {};

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const url = redactUrl(typeof input === 'string' ? input : String(input));
    const startedAt = Date.now();

    try {
      const response = await originalFetch(input, init);
      buffer.add(
        'log',
        'network',
        `${method} ${url} -> ${response.status} (${Date.now() - startedAt}ms)`
      );
      return response;
    } catch (error) {
      buffer.add('error', 'network', `${method} ${url} -> failed (${Date.now() - startedAt}ms)`, {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

interface ErrorUtilsShape {
  getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
}

/**
 * Installs a global error handler appropriate to the runtime.
 *
 * On the web this is an `unhandledrejection` listener. On React Native it is
 * ErrorUtils, and the distinction matters more than it looks: Hermes provides
 * a `window` global aliased to globalThis but with no DOM event APIs, so
 * `typeof window !== 'undefined'` is true on native too. Checking for
 * addEventListener as a function is what actually separates them.
 *
 * `onFatal` runs before the default handler and should persist synchronously
 * -- on iOS the process is aborted on the same tick, so anything asynchronous
 * started here is killed with it.
 */
export function installGlobalHandlers(
  buffer: LogBuffer,
  onFatal?: (error: Error, isFatal: boolean) => void
): Teardown {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const listener = (event: PromiseRejectionEvent) => {
      buffer.addError('unhandled-rejection', event.reason);
    };
    window.addEventListener('unhandledrejection', listener);
    return () => window.removeEventListener('unhandledrejection', listener);
  }

  const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler || !errorUtils.getGlobalHandler) return () => {};

  const previous = errorUtils.getGlobalHandler();

  errorUtils.setGlobalHandler((error, isFatal) => {
    buffer.addError(isFatal ? 'fatal-error' : 'global-error', error);
    onFatal?.(error, Boolean(isFatal));

    // Only genuinely fatal errors reach the default handler. Forwarding
    // everything -- which is what the original did -- defeats the wrapper
    // entirely: RN's default handler calls
    // NativeExceptionsManager.reportException, which for a NON-fatal error
    // still reaches RCTFatal and aborts the process.
    //
    // That was a real production crash: RCTFatal <- reportFatal <-
    // reportException, a deliberate process kill in response to a JS error
    // that never needed to be fatal. A rejected haptic, a failed prefetch or
    // an analytics timeout should leave a breadcrumb, not take the app down.
    if (isFatal) {
      previous?.(error, isFatal);
    }
  });

  return () => {
    errorUtils.setGlobalHandler?.(previous);
  };
}
