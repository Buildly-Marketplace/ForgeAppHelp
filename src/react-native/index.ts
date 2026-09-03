/**
 * React Native bindings.
 *
 * The provider, hooks and core are shared with the web build -- only the
 * adapters differ, and the help form is left to the host so it can use the
 * app's own components (its design system, its keyboard handling, its
 * navigation) rather than a generic one that will look foreign in every app.
 *
 * See README "Using it in React Native" for the wiring, and the Inflately
 * integration for a worked example.
 */
export {
  ReactNativeStorageAdapter,
  ReactNativePlatformAdapter,
  type AsyncStorageLike,
  type DimensionsLike,
  type ReactNativePlatformOptions,
} from './adapters.js';
export { HelpProvider, useReporter, useOptionalReporter, type HelpProviderProps } from '../react/context.js';
export * from '../core/index.js';
