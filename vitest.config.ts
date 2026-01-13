import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/__tests__/*.test.ts'],
    testTimeout: 10000,
    setupFiles: ['./src/lib/__tests__/setup.ts'],
    environmentOptions: {
      happyDOM: {
        settings: {
          navigator: {
            userAgent: 'Mozilla/5.0 (Test Environment)',
          },
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
