import type { StorageAdapter } from '../adapters/index.js';

/**
 * Vanilla-JS (framework-free) adapters.
 *
 * `UniversalPlatformAdapter` (in `../adapters/index.js`) already reads real
 * `window`/`navigator`/`document` and needs no browser-specific subclass --
 * it was written generically enough to serve this binding directly. Storage
 * is the one piece worth a dedicated adapter: `localStorage` is the natural
 * choice for a browser/webview host, and it has the same "must not lose a
 * fatal error" constraint that motivated `ReactNativeStorageAdapter`'s
 * fire-and-forget write.
 */

/**
 * Wraps `localStorage`.
 *
 * `setItem` writes synchronously (`localStorage.setItem` itself is
 * synchronous, unlike AsyncStorage) and only *returns* a resolved promise to
 * satisfy `StorageAdapter`'s async signature -- it never awaits anything
 * before or after the write. That matters for the same reason it does on
 * React Native: a fatal error's breadcrumb must be persisted before the
 * error propagates further, not after some other pending operation
 * completes, or a crash on the same tick loses it. A full page reload behaves
 * the same way as an iOS process abort for this purpose -- there is no
 * "later" for anything not already committed to storage.
 */
export class WebStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}
