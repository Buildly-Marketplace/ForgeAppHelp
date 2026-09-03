/**
 * Framework-agnostic entry point.
 *
 * Nothing here imports React, react-native or any DOM library, so it runs
 * anywhere JavaScript does -- a browser, React Native, a Node script, a test.
 * Framework bindings live in ./react and ./react-native.
 */

export { IssueReporter, DEFAULT_ENDPOINTS } from './reporter.js';
export { LogBuffer, BREADCRUMB_KEY, MAX_BREADCRUMBS } from './logger.js';
export {
  captureConsole,
  captureNetwork,
  installGlobalHandlers,
  redactUrl,
  type Teardown,
} from './capture.js';
export {
  clampScreenshots,
  MAX_SCREENSHOT_BASE64_LENGTH,
  MAX_SCREENSHOTS_TOTAL_BASE64_LENGTH,
} from './screenshots.js';
export { darkTheme, lightTheme, resolveTheme, type HelpTheme } from './theme.js';
export { nodeEnv, isDevelopment } from './env.js';
export type {
  Category,
  DebugData,
  Endpoints,
  IssueReport,
  ItemStatus,
  LogEntry,
  LogLevel,
  PunchlistItemReport,
  ReporterConfig,
  Severity,
  SubmitResult,
  TaskReport,
} from './types.js';
export {
  MemoryStorageAdapter,
  UniversalPlatformAdapter,
  defaultAdapters,
  type Adapters,
  type PlatformAdapter,
  type StorageAdapter,
} from '../adapters/index.js';
