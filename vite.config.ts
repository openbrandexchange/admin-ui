/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { thirdPartyNotices } from './scripts/third-party-notices'

// One static single-page app for both the retailer portal (/) and the brand admin (/admin).
// `base: './'` makes every asset path relative; index.html carries <base href="/"> so deep
// SPA-fallback URLs (/admin/catalog/KO-1001) still resolve assets. A node mounted under a
// sub-path only rewrites that one tag (see README "For node implementers").
// The strictest Content-Security-Policy the UI works under (README "Security headers"). The
// preview server sends it, so every Playwright run proves the UI needs nothing looser. Mock
// mode adds only worker-src for its service worker.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

/**
 * The `email.*` strings are for nodes (dist/locales/, scripts/export-locales.mjs); the browser
 * never shows them, so the language chunks of the build leave them out.
 */
function dropEmailStrings(): Plugin {
  return {
    name: 'obx-drop-email-strings',
    enforce: 'pre',
    apply: 'build',
    transform(code, id) {
      if (!/[/\\]src[/\\]locales[/\\][a-z]{2}\.json$/.test(id)) return
      const { email: _email, ...ui } = JSON.parse(code) as Record<string, unknown>
      return { code: JSON.stringify(ui), map: null }
    },
  }
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss(), dropEmailStrings(), ...(mode === 'mock' ? [] : [thirdPartyNotices()])],
  // Mock mode serves the spec's fixture images and the MSW worker; the production build ships neither.
  publicDir: mode === 'mock' ? 'mock-public' : false,
  define: {
    'import.meta.env.VITE_OBX_MOCK': JSON.stringify(mode === 'mock' ? '1' : ''),
  },
  build: {
    target: 'es2023',
    sourcemap: false,
    assetsDir: 'assets',
    chunkSizeWarningLimit: 600,
  },
  preview: {
    headers: {
      'Content-Security-Policy': CSP + (mode === 'mock' ? "; worker-src 'self'" : ''),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    },
  },
  server: {
    // `npm run dev` against a real node: OBX_NODE_URL=http://localhost:8080 npm run dev
    proxy: process.env.OBX_NODE_URL
      ? {
          '/admin/api': { target: process.env.OBX_NODE_URL },
          '/obx': { target: process.env.OBX_NODE_URL },
          '/.well-known': { target: process.env.OBX_NODE_URL },
        }
      : undefined,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
  },
}))
