import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
    hookTimeout: 15000,
  },
  resolve: {
    alias: {
      '@webchat/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
