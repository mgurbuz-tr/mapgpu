import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    globals: false,
  },
});
