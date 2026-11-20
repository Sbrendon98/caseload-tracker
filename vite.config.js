import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// The browser itself refuses any network connection from the page (connect-src 'none'), so even a
// library that tried to phone home could not. Added to production builds only: the dev server
// needs a websocket for hot reload.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const contentSecurityPolicy = () => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: html => html.replace('<!--csp-->', `<meta http-equiv="Content-Security-Policy" content="${CSP}">`),
});

export default defineConfig({
  // Relative URLs, so the site works from https://<user>.github.io/<repo>/ without knowing the repo name.
  base: './',
  plugins: [
    preact(),
    contentSecurityPolicy(),
    VitePWA({
      // A new version waits until she taps "Update", so a screen is never swapped mid-entry.
      registerType: 'prompt',
      injectRegister: false,
      manifest: false, // we ship public/manifest.webmanifest ourselves
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.{mjs,js,jsx}'],
  },
});
