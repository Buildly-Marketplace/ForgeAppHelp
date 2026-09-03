import { defaultAdapters, type Adapters } from '../adapters/index.js';
import {
  captureConsole,
  captureNetwork,
  installGlobalHandlers,
  type Teardown,
} from './capture.js';
import { isDevelopment, nodeEnv } from './env.js';
import { LogBuffer } from './logger.js';
import { clampScreenshots } from './screenshots.js';
import type {
  DebugData,
  Endpoints,
  IssueReport,
  LogEntry,
  LogLevel,
  PunchlistItemReport,
  ReporterConfig,
  SubmitResult,
} from './types.js';

export const DEFAULT_ENDPOINTS: Endpoints = {
  issues: 'https://labs.buildly.io/api/v1/issues',
  punchlist: 'https://labs.buildly.io/api/v1/punchlist',
  tasks: 'https://labs.buildly.io/api/v1/tasks',
};

/**
 * Collects debug context and submits reports to Buildly Labs.
 *
 * Construct one per app and share it. The constructor installs no handlers --
 * call `start()` for that, so tests and server renders can build a reporter
 * without patching globals.
 */
export class IssueReporter {
  private readonly adapters: Adapters;
  private readonly endpoints: Endpoints;
  private readonly buffer: LogBuffer;
  private teardowns: Teardown[] = [];
  private started = false;

  private productId: string;
  private apiKey: string;
  private isTestMode: boolean;
  private appVersion: string;
  private buildNumber: string;
  private readonly config: ReporterConfig;

  constructor(config: ReporterConfig, adapters: Adapters = defaultAdapters()) {
    this.config = config;
    this.adapters = adapters;
    this.endpoints = { ...DEFAULT_ENDPOINTS, ...config.endpoints };
    this.buffer = new LogBuffer(adapters.storage, config.maxLogs ?? 500);

    this.productId = config.productId;
    this.apiKey = config.apiKey;
    // Default to test mode in development, so a developer exercising the form
    // does not file real punchlist items. Inflately learned this the hard way:
    // eleven junk issues reached the real board during a debugging session.
    this.isTestMode = config.isTestMode ?? isDevelopment();
    this.appVersion = config.appVersion ?? '1.0.0';
    this.buildNumber = config.buildNumber ?? 'unknown';
  }

  /** Installs console, network and global-error capture. Idempotent. */
  start(onFatal?: (error: Error, isFatal: boolean) => void): void {
    if (this.started) return;
    this.started = true;

    if (this.config.captureConsole !== false) {
      this.teardowns.push(captureConsole(this.buffer));
    }
    if (this.config.captureNetwork !== false) {
      this.teardowns.push(captureNetwork(this.buffer));
    }
    if (this.config.captureGlobalErrors !== false) {
      this.teardowns.push(installGlobalHandlers(this.buffer, onFatal));
    }
  }

  /** Restores every global this reporter patched. */
  stop(): void {
    for (const teardown of this.teardowns.reverse()) teardown();
    this.teardowns = [];
    this.started = false;
  }

  setCredentials(productId: string, apiKey: string, isTestMode?: boolean): void {
    this.productId = productId;
    this.apiKey = apiKey;
    if (isTestMode !== undefined) this.isTestMode = isTestMode;
  }

  /**
   * Read these from the binary, never hardcode them.
   *
   * Pinned values are worse than none: when every report claims the same
   * build, a stale install is indistinguishable from a real regression, and
   * triage burns time chasing builds that no longer exist.
   */
  setAppVersion(version: string, buildNumber: string): void {
    this.appVersion = version;
    this.buildNumber = buildNumber;
  }

  log(level: LogLevel, category: string, ...args: unknown[]): void {
    this.buffer.add(level, category, ...args);
  }

  logError(category: string, error: unknown, additionalData?: Record<string, unknown>): void {
    this.buffer.addError(category, error, additionalData);
  }

  loadPreviousSessionBreadcrumbs(): Promise<LogEntry[]> {
    return this.buffer.loadPreviousSessionBreadcrumbs();
  }

  getLogs(): LogEntry[] {
    return this.buffer.all();
  }

  clearLogs(): void {
    this.buffer.clear();
  }

  exportLogsAsJSON(): string {
    return this.buffer.toJSON();
  }

  exportLogsAsCSV(): string {
    return this.buffer.toCSV();
  }

  async getDebugData(customData?: Record<string, unknown>): Promise<DebugData> {
    const { platform } = this.adapters;
    const { screenWidth, screenHeight } = platform.getScreenDimensions();
    const resolved =
      typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions() : undefined;

    return {
      timestamp: new Date().toISOString(),
      userAgent: platform.getUserAgent(),
      platform: platform.os,
      appVersion: this.appVersion,
      buildNumber: this.buildNumber,
      locale: resolved?.locale ?? 'unknown',
      timezone: resolved?.timeZone ?? 'unknown',
      screenWidth,
      screenHeight,
      memoryUsage: platform.getMemoryUsage(),
      networkStatus: platform.getNetworkStatus(),
      isDarkMode: platform.isDarkMode(),
      isTestMode: this.isTestMode,
      environment: nodeEnv(),
      logs: this.buffer.all(),
      customData,
    };
  }

  /**
   * Files an issue.
   *
   * `includeDebugData` defaults to true. When a user opts out, the logs and
   * device context are never assembled at all -- an opt-out that still sent
   * the data behind a flag would be a lie.
   */
  async reportIssue(
    report: Omit<IssueReport, 'debugData'> & { includeDebugData?: boolean }
  ): Promise<SubmitResult> {
    if (!this.productId || !this.apiKey) {
      return { success: false, error: 'Issue reporter not configured' };
    }

    const screenshotsBase64 = clampScreenshots(report.screenshotsBase64);
    const { screenshotsBase64: _omit, includeDebugData = true, ...rest } = report;

    return this.post(this.endpoints.issues, {
      ...rest,
      ...(includeDebugData ? { debugData: await this.getDebugData() } : {}),
      ...(screenshotsBase64 ? { metadata: { screenshotsBase64 } } : {}),
    });
  }

  async reportPunchlistItem(item: PunchlistItemReport): Promise<SubmitResult> {
    return this.postItem(this.endpoints.punchlist, item);
  }

  async reportTask(item: PunchlistItemReport): Promise<SubmitResult> {
    return this.postItem(this.endpoints.tasks, item);
  }

  private async postItem(endpoint: string, item: PunchlistItemReport): Promise<SubmitResult> {
    if (!this.productId || !this.apiKey) {
      return { success: false, error: 'Issue reporter not configured' };
    }

    const screenshotsBase64 = clampScreenshots(item.screenshotsBase64);
    const { screenshotsBase64: _omit, metadata, ...rest } = item;

    // These endpoints have no debug-data field, so context travels in
    // metadata instead.
    return this.post(endpoint, {
      ...rest,
      metadata: {
        ...metadata,
        debugData: await this.getDebugData(),
        ...(screenshotsBase64 ? { screenshotsBase64 } : {}),
      },
    });
  }

  private async post(endpoint: string, body: unknown): Promise<SubmitResult> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Product-ID': this.productId,
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 404) {
        // Not every Labs deployment exposes every endpoint. Degrade to a
        // clear message rather than a user-facing failure.
        return { success: false, error: `Endpoint not available: ${endpoint}` };
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return { success: false, error: `HTTP ${response.status}${text ? `: ${text}` : ''}` };
      }

      const data = (await response.json().catch(() => ({}))) as { id?: string; issueId?: string };
      return { success: true, issueId: data.id ?? data.issueId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
