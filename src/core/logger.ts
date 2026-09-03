import type { StorageAdapter } from '../adapters/index.js';
import type { LogEntry, LogLevel } from './types.js';

export type LogSink = (...args: unknown[]) => void;

/** Where the pre-crash error tail is kept. */
export const BREADCRUMB_KEY = 'forge-app-help-breadcrumbs';
export const MAX_BREADCRUMBS = 25;

/**
 * A bounded in-memory log, with errors and warnings mirrored to storage.
 *
 * Logs live in memory, so a hard native termination -- the OS killing the
 * process rather than a JS throw -- takes every breadcrumb with it. Mirroring
 * errors to disk is the only way the next launch can say anything about what
 * happened before the crash.
 */
export class LogBuffer {
  private logs: LogEntry[] = [];
  private pendingBreadcrumbs: LogEntry[] = [];
  private crashBreadcrumbs: LogEntry[] = [];

  constructor(
    private readonly storage: StorageAdapter,
    private readonly maxLogs = 500
  ) {}

  add(level: LogLevel, category: string, ...args: unknown[]): void {
    const message = args
      .map((arg) => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg);
          } catch {
            // Circular reference, or a value JSON cannot represent.
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: args.length === 1 && typeof args[0] === 'object' ? args[0] : undefined,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Only errors and warnings are persisted, and only the last few, to keep
    // storage off the hot path for ordinary logs.
    if (level === 'error' || level === 'warn') {
      this.persistBreadcrumb(entry);
    }
  }

  addError(category: string, error: unknown, additionalData?: Record<string, unknown>): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    this.add('error', category, { message, stack, ...additionalData });
  }

  /**
   * Mirrors the breadcrumb list to storage without reading it back first.
   *
   * The read-then-write version of this lost every fatal error: RCTFatal
   * aborts the process synchronously once the exception reaches native, long
   * before a two-step async round trip completes. Keeping the list in memory
   * means a write is a single hand-off, which is all that has to happen before
   * the process dies.
   */
  private persistBreadcrumb(entry: LogEntry): void {
    this.pendingBreadcrumbs = [...this.pendingBreadcrumbs, entry].slice(-MAX_BREADCRUMBS);
    try {
      void this.storage.setItem(BREADCRUMB_KEY, JSON.stringify(this.pendingBreadcrumbs));
    } catch {
      // Diagnostics must never break the host app.
    }
  }

  /**
   * Loads breadcrumbs left by a previous session. Call once at startup: if
   * anything is here, the last run ended badly and these are the final errors
   * it recorded.
   */
  async loadPreviousSessionBreadcrumbs(): Promise<LogEntry[]> {
    try {
      const raw = await this.storage.getItem(BREADCRUMB_KEY);
      if (!raw) return [];
      this.crashBreadcrumbs = JSON.parse(raw) as LogEntry[];
      await this.storage.removeItem(BREADCRUMB_KEY);
      if (this.crashBreadcrumbs.length > 0) {
        // Surface them in this session's log so the next report picks them up.
        this.logs.unshift(
          ...this.crashBreadcrumbs.map((b) => ({
            ...b,
            category: `previous-session:${b.category}`,
          }))
        );
      }
      return this.crashBreadcrumbs;
    } catch {
      return [];
    }
  }

  all(): LogEntry[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }

  toJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  toCSV(): string {
    const header = 'timestamp,level,category,message';
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = this.logs.map((l) =>
      [l.timestamp, l.level, l.category, escape(l.message)].join(',')
    );
    return [header, ...rows].join('\n');
  }
}
