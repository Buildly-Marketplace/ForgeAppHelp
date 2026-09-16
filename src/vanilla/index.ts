/**
 * Vanilla-JS (framework-free) bindings.
 *
 * For a browser or webview app with no React/React Native -- Tauri, Electron,
 * a plain multi-page site, a Node-driven test harness with a DOM. Ships a
 * ready-made `HelpForm` the same way the React binding does (a generic form
 * is a reasonable default here, since a real DOM host has real CSS to theme
 * it with -- unlike React Native, where a generic form looks foreign in
 * every app and the binding leaves the UI to the host entirely).
 */
export { createHelpClient, stopHelpClient } from './client.js';
export { HelpForm, type HelpFormOptions } from './HelpForm.js';
export { WebStorageAdapter } from './adapters.js';
export * from '../core/index.js';
