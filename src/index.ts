/**
 * Default entry point -- the framework-agnostic core.
 *
 * Deliberately does NOT re-export the React bindings: importing this from a
 * non-React host (a Node script, a worker) must not drag React in.
 *
 *   import { IssueReporter } from '@buildly/forge-app-help';
 *   import { HelpProvider, HelpForm } from '@buildly/forge-app-help/react';
 *   import { ReactNativeStorageAdapter } from '@buildly/forge-app-help/react-native';
 */
export * from './core/index.js';
