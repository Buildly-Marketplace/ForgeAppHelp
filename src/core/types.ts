/**
 * Shapes shared by every entry point in this package.
 *
 * These mirror the Buildly Labs API request bodies. Where a field exists only
 * because Labs has no equivalent feature -- screenshots, most obviously -- the
 * comment says so, since the workaround is not obvious from the shape alone.
 */

export type LogLevel = 'log' | 'warn' | 'error' | 'info';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type Category = 'bug' | 'feature-request' | 'performance' | 'ui-ux' | 'other';

export type ItemStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

export interface DebugData {
  timestamp: string;
  userAgent: string;
  platform: string;
  appVersion: string;
  buildNumber: string;
  locale: string;
  timezone: string;
  screenWidth: number;
  screenHeight: number;
  memoryUsage?: number;
  networkStatus: string;
  isDarkMode: boolean;
  isTestMode: boolean;
  userId?: string;
  environment: 'development' | 'staging' | 'production';
  logs: LogEntry[];
  errorStack?: string;
  customData?: Record<string, unknown>;
}

export interface IssueReport {
  title: string;
  description: string;
  severity: Severity;
  category: Category;
  debugData: DebugData;
  contactEmail?: string;
  replicationSteps?: string;
  /**
   * Labs has no file-upload endpoint -- only text fields plus an open
   * `metadata` object. Screenshots ride along as base64 data URIs inside
   * metadata.screenshotsBase64. Whether the Labs UI renders them as images
   * or as raw text is out of our hands; this is the only way to attach any.
   */
  screenshotsBase64?: string[];
}

export interface PunchlistItemReport {
  title: string;
  description?: string;
  severity?: Severity;
  status?: ItemStatus;
  metadata?: Record<string, unknown>;
  screenshotsBase64?: string[];
}

export type TaskReport = PunchlistItemReport;

export interface SubmitResult {
  success: boolean;
  issueId?: string;
  error?: string;
}

/** Where the reporter sends things. Override per environment or for tests. */
export interface Endpoints {
  issues: string;
  punchlist: string;
  tasks: string;
}

export interface ReporterConfig {
  /** Buildly Labs product UUID -- sent as the X-Product-ID header. */
  productId: string;
  /** Buildly Labs API key -- sent as the X-API-Key header. */
  apiKey: string;
  /**
   * Marks submitted reports as test data. Defaults to true in development so
   * a developer poking at the form does not file real punchlist items.
   */
  isTestMode?: boolean;
  appVersion?: string;
  buildNumber?: string;
  /** Defaults to https://labs.buildly.io/api/v1/*. */
  endpoints?: Partial<Endpoints>;
  /** Ring-buffer size for captured logs. Defaults to 500. */
  maxLogs?: number;
  /**
   * Capture console.error / console.warn into the log buffer. Default true.
   * Turn off if another tool already patches the console.
   */
  captureConsole?: boolean;
  /**
   * Wrap global fetch to log method, redacted URL, status and duration.
   * Default true. Bodies are never logged -- they carry PII and secrets.
   */
  captureNetwork?: boolean;
  /**
   * Install a global handler for unhandled rejections and uncaught errors.
   * Default true. See installGlobalHandlers for why this matters on native.
   */
  captureGlobalErrors?: boolean;
}
