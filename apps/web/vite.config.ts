import react from '@vitejs/plugin-react';
// From vitest rather than vite: `test` is vitest's key, and vite's own
// defineConfig rejects it as unknown.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    // Deliberately not `globals: true`. Every test imports what it uses, so a
    // reader can tell where `expect` came from, and the type surface does not
    // depend on an ambient declaration being picked up.
    setupFiles: ['./src/test-setup.ts'],
  },
});
