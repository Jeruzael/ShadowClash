import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@shadow-clash/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)) } },
  test: { include: ['packages/**/*.test.ts', 'apps/server/**/*.test.ts'], testTimeout: 10000, hookTimeout: 10000 },
});
