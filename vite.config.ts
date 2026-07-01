import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // The server has its own jest suite (server/npm test) — keep vitest to the
    // frontend only, and stay green while there are no frontend unit tests yet.
    exclude: ['node_modules/**', 'dist/**', 'server/**'],
    passWithNoTests: true,
  },
});
