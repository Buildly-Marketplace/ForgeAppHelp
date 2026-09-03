import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogBuffer, BREADCRUMB_KEY, MAX_BREADCRUMBS } from '../../src/core/logger';
import { MemoryStorageAdapter } from '../../src/adapters';

describe('LogBuffer', () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  it('keeps entries bounded to maxLogs', () => {
    const buffer = new LogBuffer(storage, 3);
    for (let i = 0; i < 10; i += 1) buffer.add('log', 'test', `entry ${i}`);

    const logs = buffer.all();
    expect(logs).toHaveLength(3);
    expect(logs[0]?.message).toBe('entry 7');
    expect(logs[2]?.message).toBe('entry 9');
  });

  it('serialises object arguments without throwing on a cycle', () => {
    const buffer = new LogBuffer(storage);
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic.self = cyclic;

    expect(() => buffer.add('log', 'test', cyclic)).not.toThrow();
    expect(buffer.all()[0]?.message).toContain('object');
  });

  /**
   * The read-then-write version of persistBreadcrumb lost every fatal error,
   * because RCTFatal aborts the process before an async round trip finishes.
   * A write must therefore never await a read first.
   */
  it('writes breadcrumbs without reading storage first', () => {
    const getItem = vi.spyOn(storage, 'getItem');
    const buffer = new LogBuffer(storage);

    buffer.add('error', 'boom', 'something failed');

    expect(getItem).not.toHaveBeenCalled();
  });

  it('persists errors and warnings, but not ordinary logs', async () => {
    const setItem = vi.spyOn(storage, 'setItem');
    const buffer = new LogBuffer(storage);

    buffer.add('log', 'chatter', 'nothing to see');
    buffer.add('info', 'chatter', 'still nothing');
    expect(setItem).not.toHaveBeenCalled();

    buffer.add('warn', 'careful', 'hmm');
    buffer.add('error', 'boom', 'bang');
    expect(setItem).toHaveBeenCalledTimes(2);

    const raw = await storage.getItem(BREADCRUMB_KEY);
    expect(JSON.parse(raw ?? '[]')).toHaveLength(2);
  });

  it('caps persisted breadcrumbs', async () => {
    const buffer = new LogBuffer(storage);
    for (let i = 0; i < MAX_BREADCRUMBS + 15; i += 1) {
      buffer.add('error', 'boom', `failure ${i}`);
    }

    const raw = await storage.getItem(BREADCRUMB_KEY);
    expect(JSON.parse(raw ?? '[]')).toHaveLength(MAX_BREADCRUMBS);
  });

  it('recovers a dead session breadcrumbs and clears them', async () => {
    const previous = new LogBuffer(storage);
    previous.addError('startup', new Error('died here'));

    const next = new LogBuffer(storage);
    const recovered = await next.loadPreviousSessionBreadcrumbs();

    expect(recovered).toHaveLength(1);
    expect(next.all()[0]?.category).toBe('previous-session:startup');
    // Cleared, so the next launch does not re-report the same crash.
    expect(await storage.getItem(BREADCRUMB_KEY)).toBeNull();
  });

  it('returns an empty list when storage holds nothing', async () => {
    const buffer = new LogBuffer(storage);
    expect(await buffer.loadPreviousSessionBreadcrumbs()).toEqual([]);
  });

  it('survives corrupt stored breadcrumbs', async () => {
    await storage.setItem(BREADCRUMB_KEY, 'not json');
    const buffer = new LogBuffer(storage);

    expect(await buffer.loadPreviousSessionBreadcrumbs()).toEqual([]);
  });

  it('captures an Error message and stack', () => {
    const buffer = new LogBuffer(storage);
    buffer.addError('render', new Error('kaboom'));

    const entry = buffer.all()[0];
    expect(entry?.level).toBe('error');
    expect(entry?.message).toContain('kaboom');
  });

  it('exports CSV with quotes escaped', () => {
    const buffer = new LogBuffer(storage);
    buffer.add('log', 'test', 'he said "hello"');

    const csv = buffer.toCSV();
    expect(csv.split('\n')[0]).toBe('timestamp,level,category,message');
    expect(csv).toContain('""hello""');
  });
});
