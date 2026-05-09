/// <reference types="vitest" />
import fs from 'node:fs';
import path from 'node:path';
import { type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

function emit404Fallback(): Plugin {
  return {
    name: 'crufy:emit-404-fallback',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve('dist');
      const index = path.join(dist, 'index.html');
      const fallback = path.join(dist, '404.html');
      if (fs.existsSync(index)) {
        fs.copyFileSync(index, fallback);
      }
    },
  };
}

export default defineConfig({
  base: '/CRUFYmanager/',
  plugins: [react(), emit404Fallback()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
