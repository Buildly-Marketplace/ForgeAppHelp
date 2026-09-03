import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IssueReporter, DEFAULT_ENDPOINTS } from '../../src/core/reporter';
import { MemoryStorageAdapter, UniversalPlatformAdapter } from '../../src/adapters';
import { clampScreenshots, MAX_SCREENSHOT_BASE64_LENGTH } from '../../src/core/screenshots';

const adapters = () => ({
  storage: new MemoryStorageAdapter(),
  platform: new UniversalPlatformAdapter('test'),
});

const config = { productId: 'product-1', apiKey: 'key-1', isTestMode: true };

let fetchMock: ReturnType<typeof vi.fn>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'issue-9' }), { status: 201 }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const bodyOf = (call: number = 0) =>
  JSON.parse(String((fetchMock.mock.calls[call]?.[1] as RequestInit).body));

describe('IssueReporter', () => {
  it('refuses to submit without credentials, rather than posting anonymously', async () => {
    const reporter = new IssueReporter({ productId: '', apiKey: '' }, adapters());
    const result = await reporter.reportIssue({
      title: 'x',
      description: '',
      severity: 'low',
      category: 'bug',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the Labs auth headers', async () => {
    const reporter = new IssueReporter(config, adapters());
    await reporter.reportIssue({ title: 'x', description: '', severity: 'low', category: 'bug' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DEFAULT_ENDPOINTS.issues);
    expect(init.headers).toMatchObject({
      'X-Product-ID': 'product-1',
      'X-API-Key': 'key-1',
    });
  });

  it('honours a custom endpoint', async () => {
    const reporter = new IssueReporter(
      { ...config, endpoints: { issues: 'https://labs.internal/api/v1/issues' } },
      adapters()
    );
    await reporter.reportIssue({ title: 'x', description: '', severity: 'low', category: 'bug' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://labs.internal/api/v1/issues');
  });

  it('attaches debug data by default', async () => {
    const reporter = new IssueReporter(config, adapters());
    await reporter.reportIssue({ title: 'x', description: '', severity: 'low', category: 'bug' });

    expect(bodyOf().debugData).toBeDefined();
    expect(bodyOf().debugData.platform).toBe('test');
  });

  /**
   * An opt-out that still sent the data behind a flag would be a lie. The
   * logs must not be assembled at all.
   */
  it('sends no debug data at all when the user opts out', async () => {
    const reporter = new IssueReporter(config, adapters());
    reporter.log('error', 'secret', 'user@example.com placed order 123');

    await reporter.reportIssue({
      title: 'x',
      description: '',
      severity: 'low',
      category: 'bug',
      includeDebugData: false,
    });

    const body = bodyOf();
    expect(body.debugData).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('user@example.com');
  });

  it('reports the version it was told, not a hardcoded one', async () => {
    const reporter = new IssueReporter(config, adapters());
    reporter.setAppVersion('2.4.1', '87');
    await reporter.reportIssue({ title: 'x', description: '', severity: 'low', category: 'bug' });

    expect(bodyOf().debugData).toMatchObject({ appVersion: '2.4.1', buildNumber: '87' });
  });

  it('carries captured logs into the report', async () => {
    const reporter = new IssueReporter(config, adapters());
    reporter.log('error', 'checkout', 'payment declined');
    await reporter.reportIssue({ title: 'x', description: '', severity: 'low', category: 'bug' });

    const logs = bodyOf().debugData.logs as Array<{ message: string }>;
    expect(logs.some((l) => l.message.includes('payment declined'))).toBe(true);
  });

  it('reports a 404 as an unavailable endpoint rather than a hard failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));
    const reporter = new IssueReporter(config, adapters());

    const result = await reporter.reportPunchlistItem({ title: 'x' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');
  });

  it('surfaces an HTTP error with its status', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad request', { status: 400 }));
    const reporter = new IssueReporter(config, adapters());

    const result = await reporter.reportIssue({
      title: 'x',
      description: '',
      severity: 'low',
      category: 'bug',
    });
    expect(result).toMatchObject({ success: false });
    expect(result.error).toContain('400');
  });

  it('surfaces a network failure instead of throwing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const reporter = new IssueReporter(config, adapters());

    await expect(
      reporter.reportIssue({ title: 'x', description: '', severity: 'low', category: 'bug' })
    ).resolves.toMatchObject({ success: false, error: 'offline' });
  });

  it('returns the created id', async () => {
    const reporter = new IssueReporter(config, adapters());
    const result = await reporter.reportIssue({
      title: 'x',
      description: '',
      severity: 'low',
      category: 'bug',
    });

    expect(result).toMatchObject({ success: true, issueId: 'issue-9' });
  });

  it('routes punchlist debug context through metadata, which has no debugData field', async () => {
    const reporter = new IssueReporter(config, adapters());
    await reporter.reportPunchlistItem({ title: 'a punchlist item', severity: 'high' });

    const body = bodyOf();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(DEFAULT_ENDPOINTS.punchlist);
    expect(body.debugData).toBeUndefined();
    expect(body.metadata.debugData).toBeDefined();
  });

  it('installs and removes its global patches', () => {
    const reporter = new IssueReporter(config, adapters());
    const before = console.error;

    reporter.start();
    expect(console.error).not.toBe(before);

    reporter.stop();
    expect(console.error).toBe(before);
  });

  it('is safe to start twice', () => {
    const reporter = new IssueReporter(config, adapters());
    const before = console.error;

    reporter.start();
    const afterFirst = console.error;
    reporter.start();
    expect(console.error).toBe(afterFirst);

    reporter.stop();
    expect(console.error).toBe(before);
  });
});

describe('clampScreenshots', () => {
  it('returns undefined for nothing', () => {
    expect(clampScreenshots(undefined)).toBeUndefined();
    expect(clampScreenshots([])).toBeUndefined();
  });

  it('drops an oversized image and keeps the rest', () => {
    const warn = vi.fn();
    const big = 'x'.repeat(MAX_SCREENSHOT_BASE64_LENGTH + 1);

    expect(clampScreenshots([big, 'small'], warn)).toEqual(['small']);
    expect(warn).toHaveBeenCalled();
  });

  it('keeps the earliest attachments when the total cap is exceeded', () => {
    const warn = vi.fn();
    const each = 'y'.repeat(MAX_SCREENSHOT_BASE64_LENGTH);
    // Five at the per-image cap exceeds the 1.2MB total, so some must go.
    const kept = clampScreenshots([each, each, each, each, each], warn);

    expect(kept?.length).toBe(4);
    expect(warn).toHaveBeenCalled();
  });
});
