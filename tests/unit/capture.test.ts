import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureConsole, captureNetwork, installGlobalHandlers, redactUrl } from '../../src/core/capture';
import { LogBuffer } from '../../src/core/logger';
import { MemoryStorageAdapter } from '../../src/adapters';

const newBuffer = () => new LogBuffer(new MemoryStorageAdapter());

describe('redactUrl', () => {
  it('replaces every query-string value', () => {
    expect(redactUrl('https://maps.googleapis.com/geocode?key=SECRET&address=1+Main+St')).toBe(
      'https://maps.googleapis.com/geocode?key=%5Bredacted%5D&address=%5Bredacted%5D'
    );
  });

  it('leaves a path-only URL alone', () => {
    expect(redactUrl('https://api.example.com/v1/orders')).toBe('https://api.example.com/v1/orders');
  });

  it('resolves a relative URL against the page, and still redacts it', () => {
    // In a browser a relative URL is meaningful, so it is resolved rather
    // than passed through -- the query string still has to be scrubbed.
    expect(redactUrl('/api/orders?token=SECRET')).toContain('%5Bredacted%5D');
    expect(redactUrl('/api/orders?token=SECRET')).not.toContain('SECRET');
  });

  it('returns an unparseable URL unchanged rather than dropping the entry', () => {
    // A lone scheme with no host is one of the few things new URL() rejects
    // outright even with a base. The entry is worth more than perfect
    // formatting, so it is logged as-is.
    expect(redactUrl('http://')).toBe('http://');
  });
});

describe('captureConsole', () => {
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it('records console.error and still calls through', () => {
    const buffer = newBuffer();
    const original = console.error;
    const spy = vi.fn();
    console.error = spy;

    restore = captureConsole(buffer);
    console.error('boom');

    expect(spy).toHaveBeenCalledWith('boom');
    expect(buffer.all()[0]?.category).toBe('console-error');

    restore();
    restore = undefined;
    console.error = original;
  });

  it('restores the original console on teardown', () => {
    const buffer = newBuffer();
    const before = console.warn;

    const teardown = captureConsole(buffer);
    expect(console.warn).not.toBe(before);

    teardown();
    expect(console.warn).toBe(before);
  });
});

describe('captureNetwork', () => {
  it('logs method, redacted URL, status and restores fetch', async () => {
    const buffer = newBuffer();
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 201 })) as typeof fetch;

    const teardown = captureNetwork(buffer);
    await fetch('https://api.example.com/things?token=SECRET', { method: 'POST' });

    const entry = buffer.all().find((l) => l.category === 'network');
    expect(entry?.message).toContain('POST');
    expect(entry?.message).toContain('201');
    expect(entry?.message).not.toContain('SECRET');

    teardown();
    expect(globalThis.fetch).not.toBe(undefined);
    globalThis.fetch = original;
  });

  it('logs a failure and rethrows', async () => {
    const buffer = newBuffer();
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;

    const teardown = captureNetwork(buffer);
    await expect(fetch('https://api.example.com/things')).rejects.toThrow('offline');

    const entry = buffer.all().find((l) => l.level === 'error' && l.category === 'network');
    expect(entry?.message).toContain('failed');

    teardown();
    globalThis.fetch = original;
  });

  it('never logs the request body', async () => {
    const buffer = newBuffer();
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as typeof fetch;

    const teardown = captureNetwork(buffer);
    await fetch('https://api.example.com/orders', {
      method: 'POST',
      body: JSON.stringify({ card: '4111111111111111' }),
    });

    expect(buffer.toJSON()).not.toContain('4111111111111111');

    teardown();
    globalThis.fetch = original;
  });
});

/**
 * The production crash this guards against: RN's default handler calls
 * NativeExceptionsManager.reportException, which reaches RCTFatal and aborts
 * the process -- even for an error the runtime did NOT flag fatal. Forwarding
 * everything therefore turns a harmless rejected promise into a hard crash.
 */
describe('installGlobalHandlers on a native-like runtime', () => {
  type Handler = (error: Error, isFatal?: boolean) => void;

  const withNativeRuntime = (fn: (installed: () => Handler | undefined, defaultHandler: ReturnType<typeof vi.fn>) => void) => {
    const g = globalThis as Record<string, unknown>;
    const savedAddEventListener = (g as { addEventListener?: unknown }).addEventListener;
    // Hermes has `window` but no DOM event API. Removing addEventListener is
    // what makes this look like native to the code under test.
    delete (g as { addEventListener?: unknown }).addEventListener;

    const defaultHandler = vi.fn();
    let installed: Handler | undefined;
    g.ErrorUtils = {
      getGlobalHandler: () => defaultHandler as unknown as Handler,
      setGlobalHandler: (h: Handler) => {
        installed = h;
      },
    };

    try {
      fn(() => installed, defaultHandler);
    } finally {
      delete g.ErrorUtils;
      if (savedAddEventListener) {
        (g as { addEventListener?: unknown }).addEventListener = savedAddEventListener;
      }
    }
  };

  it('does not escalate a non-fatal error to the default handler', () => {
    withNativeRuntime((installed, defaultHandler) => {
      installGlobalHandlers(newBuffer());
      installed()?.(new Error('haptics unavailable'), false);

      expect(defaultHandler).not.toHaveBeenCalled();
    });
  });

  it('treats an omitted isFatal as non-fatal', () => {
    withNativeRuntime((installed, defaultHandler) => {
      installGlobalHandlers(newBuffer());
      installed()?.(new Error('analytics timed out'));

      expect(defaultHandler).not.toHaveBeenCalled();
    });
  });

  it('still forwards genuinely fatal errors', () => {
    withNativeRuntime((installed, defaultHandler) => {
      installGlobalHandlers(newBuffer());
      const fatal = new Error('render failed irrecoverably');
      installed()?.(fatal, true);

      expect(defaultHandler).toHaveBeenCalledWith(fatal, true);
    });
  });

  it('calls onFatal before the default handler, for synchronous persistence', () => {
    withNativeRuntime((installed) => {
      const order: string[] = [];
      const onFatal = vi.fn(() => order.push('onFatal'));
      installGlobalHandlers(newBuffer(), onFatal);
      installed()?.(new Error('fatal'), true);

      expect(onFatal).toHaveBeenCalledWith(expect.any(Error), true);
      expect(order[0]).toBe('onFatal');
    });
  });

  it('logs a burst of non-fatal errors without escalating any', () => {
    withNativeRuntime((installed, defaultHandler) => {
      const buffer = newBuffer();
      installGlobalHandlers(buffer);
      for (let i = 0; i < 20; i += 1) installed()?.(new Error(`background ${i}`), false);

      expect(defaultHandler).not.toHaveBeenCalled();
      expect(buffer.all().length).toBeGreaterThan(0);
    });
  });
});

describe('installGlobalHandlers on the web', () => {
  it('listens for unhandledrejection and removes the listener on teardown', () => {
    const buffer = newBuffer();
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');

    const teardown = installGlobalHandlers(buffer);
    expect(add).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

    teardown();
    expect(remove).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

    add.mockRestore();
    remove.mockRestore();
  });
});
