/**
 * Reads NODE_ENV without assuming `process` exists.
 *
 * Bundlers usually inline process.env.NODE_ENV, but not always -- a plain
 * browser ESM build or a Hermes bundle can reach this code with no `process`
 * at all, and a bare reference throws a ReferenceError. A diagnostics library
 * must not be the thing that crashes the host.
 */
export function nodeEnv(): 'development' | 'staging' | 'production' {
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    const value = proc?.env?.NODE_ENV;
    if (value === 'development' || value === 'staging' || value === 'production') return value;
  } catch {
    // Some sandboxes throw on the property access itself.
  }
  return 'production';
}

export const isDevelopment = (): boolean => nodeEnv() === 'development';
