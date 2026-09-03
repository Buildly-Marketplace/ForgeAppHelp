import type { PlatformAdapter, StorageAdapter } from '../adapters/index.js';

/**
 * React Native adapters.
 *
 * These take their dependencies as arguments rather than importing
 * react-native and AsyncStorage directly, so this file stays importable in a
 * plain Node test and the package never forces a native dependency on a web
 * consumer.
 */

export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface DimensionsLike {
  get(dim: 'window' | 'screen'): { width: number; height: number };
}

/**
 * Wraps AsyncStorage, deliberately fire-and-forget on write.
 *
 * setItem hands the string to the native module and returns without awaiting
 * the round trip. That is the point: on iOS a fatal JS error aborts the
 * process synchronously, so the hand-off is the only part guaranteed to
 * happen. Awaiting here would lose exactly the errors worth keeping.
 */
export class ReactNativeStorageAdapter implements StorageAdapter {
  constructor(private readonly asyncStorage: AsyncStorageLike) {}

  getItem(key: string): Promise<string | null> {
    return this.asyncStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    void this.asyncStorage.setItem(key, value);
  }

  removeItem(key: string): Promise<void> {
    return this.asyncStorage.removeItem(key);
  }
}

export interface ReactNativePlatformOptions {
  /** Platform.OS from react-native. */
  os: string;
  /** Dimensions from react-native. */
  dimensions?: DimensionsLike;
  /**
   * Appearance.getColorScheme() result, or a getter for it.
   *
   * undefined is accepted as well as null because that is what React Native's
   * ColorSchemeName actually is -- requiring null only forced every caller to
   * write `?? null` around the real API.
   */
  colorScheme?:
    | 'light'
    | 'dark'
    | null
    | undefined
    | (() => 'light' | 'dark' | null | undefined);
  /** NetInfo-backed connectivity getter, if the app has NetInfo. */
  getNetworkStatus?: () => string;
}

export class ReactNativePlatformAdapter implements PlatformAdapter {
  readonly os: string;

  constructor(private readonly options: ReactNativePlatformOptions) {
    this.os = options.os;
  }

  getScreenDimensions() {
    const window = this.options.dimensions?.get('window');
    return {
      screenWidth: window?.width ?? 0,
      screenHeight: window?.height ?? 0,
    };
  }

  getNetworkStatus(): string {
    // Without NetInfo there is nothing reliable to report: navigator.onLine
    // is not implemented on Hermes, and guessing 'online' would be worse than
    // admitting we do not know.
    return this.options.getNetworkStatus?.() ?? 'unknown';
  }

  getMemoryUsage(): number | undefined {
    return undefined;
  }

  isDarkMode(): boolean {
    const scheme = this.options.colorScheme;
    const resolved = typeof scheme === 'function' ? scheme() : scheme;
    return resolved === 'dark';
  }

  getUserAgent(): string {
    return `react-native/${this.os}`;
  }
}
