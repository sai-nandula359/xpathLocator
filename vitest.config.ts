import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    // tests/e2e/** uses *.spec.ts (Playwright, run separately via `npm run test:e2e`), so a
    // broad tests/**/*.test.ts glob picks up every Vitest suite without also sweeping those in.
    include: ['tests/**/*.test.ts'],
  },
});
