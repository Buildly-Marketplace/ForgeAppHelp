import type { LogSink } from './logger.js';

/**
 * Screenshots ride inside a JSON metadata field, not a dedicated upload, and
 * base64 inflates roughly 33% over raw bytes. 300KB base64 (~225KB image) is
 * generous for a compressed screenshot without risking the whole report being
 * rejected or timing out on a slow connection.
 */
export const MAX_SCREENSHOT_BASE64_LENGTH = 300_000;
export const MAX_SCREENSHOTS_TOTAL_BASE64_LENGTH = 1_200_000;

/**
 * Drops any screenshot over the per-image cap, then drops trailing
 * screenshots until the combined size is back under the total cap.
 *
 * Never throws: a report should still submit without its screenshots rather
 * than fail outright.
 */
export function clampScreenshots(
  screenshots: string[] | undefined,
  warn: LogSink = console.warn
): string[] | undefined {
  if (!screenshots || screenshots.length === 0) return undefined;

  const withinPerImageLimit = screenshots.filter((s) => {
    if (s.length <= MAX_SCREENSHOT_BASE64_LENGTH) return true;
    warn(
      `[forge-app-help] Screenshot dropped -- ${s.length} chars exceeds the ${MAX_SCREENSHOT_BASE64_LENGTH} per-image limit.`
    );
    return false;
  });

  const kept: string[] = [];
  let total = 0;
  for (const s of withinPerImageLimit) {
    if (total + s.length > MAX_SCREENSHOTS_TOTAL_BASE64_LENGTH) {
      warn(
        `[forge-app-help] Screenshot dropped -- combined size would exceed the ${MAX_SCREENSHOTS_TOTAL_BASE64_LENGTH} total limit.`
      );
      continue;
    }
    kept.push(s);
    total += s.length;
  }

  return kept.length > 0 ? kept : undefined;
}
