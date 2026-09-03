/**
 * The two host-specific things this package needs.
 *
 * In Inflately these were `Platform` from react-native and AsyncStorage,
 * imported directly -- which is exactly what made the code impossible to lift
 * out. Behind this interface the same reporter runs in a browser, in React
 * Native, or in a test with no host at all.
 */

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  /**
   * MUST hand off to the underlying store synchronously where the platform
   * allows it, and MUST NOT read before writing.
   *
   * This is not a style preference. On iOS, RCTFatal aborts the process
   * synchronously as soon as a fatal JS exception reaches native -- an
   * implementation that awaits a read before writing loses every fatal error,
   * because the round trip never completes. That bug cost four days of empty
   * crash reports in the app this was extracted from.
   */
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface PlatformAdapter {
  /** 'ios' | 'android' | 'web' | anything else meaningful to your host. */
  readonly os: string;
  /** Viewport size, best effort. Zeroes are fine when unknowable. */
  getScreenDimensions(): { screenWidth: number; screenHeight: number };
  /** 'online' | 'offline' | 'unknown'. */
  getNetworkStatus(): string;
  /** JS heap bytes if the host exposes it. */
  getMemoryUsage(): number | undefined;
  isDarkMode(): boolean;
  getUserAgent(): string;
}

export interface Adapters {
  storage: StorageAdapter;
  platform: PlatformAdapter;
}

/**
 * In-memory storage. Used when no host storage is supplied, and in tests.
 *
 * Breadcrumbs kept here do not survive a crash -- which is the whole point of
 * persisting them -- so a real StorageAdapter should be supplied on any
 * platform that has one.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/** Reads whatever the current JS environment happens to expose. */
export class UniversalPlatformAdapter implements PlatformAdapter {
  constructor(readonly os: string = detectOS()) {}

  getScreenDimensions() {
    if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
      return { screenWidth: window.innerWidth, screenHeight: window.innerHeight };
    }
    return { screenWidth: 0, screenHeight: 0 };
  }

  getNetworkStatus(): string {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine ? 'online' : 'offline';
    }
    return 'unknown';
  }

  getMemoryUsage(): number | undefined {
    const perf = typeof performance !== 'undefined'
      ? (performance as Performance & { memory?: { usedJSHeapSize: number } })
      : undefined;
    return perf?.memory?.usedJSHeapSize;
  }

  isDarkMode(): boolean {
    // Hermes defines `window` as an alias of globalThis but gives it no DOM
    // APIs, so the matchMedia check must be a function check, not a truthiness
    // check on window.
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }

  getUserAgent(): string {
    return typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  }
}

function detectOS(): string {
  // A real DOM means a browser. React Native's Hermes has `window` but no
  // document, which is the cheapest reliable way to tell them apart without
  // importing react-native here.
  if (typeof document !== 'undefined') return 'web';
  return 'unknown';
}

export const defaultAdapters = (): Adapters => ({
  storage: new MemoryStorageAdapter(),
  platform: new UniversalPlatformAdapter(),
});
