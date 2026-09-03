import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// This config builds the DEMO app (example/), not the library. The library is
// compiled by tsc via `npm run build:lib`, which emits per-entry-point
// declarations that a bundle cannot produce.
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 8000,
    host: '0.0.0.0',
  },
  preview: {
    port: Number(process.env.PORT) || 8000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist-demo',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/unit/setup.ts',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
});
