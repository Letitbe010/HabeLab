/// <reference types="vitest" />
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { reviewPlugin } from './tools/review-plugin';
import pkg from './package.json';

function commit(): string {
  if (process.env.VITE_COMMIT) return process.env.VITE_COMMIT.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

// GitHub Pages serves the app from /HabeLab/ (repository name, case-sensitive).
const BASE = '/HabeLab/';

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT__: JSON.stringify(commit()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    reviewPlugin(fileURLToPath(new URL('.', import.meta.url))),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'HabeLab — habe isostatikoak',
        short_name: 'HabeLab',
        description: 'Habe isostatikoen ariketak (OPE 1508) / ejercicios de vigas isostáticas',
        lang: 'eu',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#eceff4',
        theme_color: '#0f1b2d',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: BASE + 'index.html',
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
