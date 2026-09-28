/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { thirdPartyNotices } from './scripts/third-party-notices'

// One static single-page app for both the retailer portal (/) and the brand admin (/admin).
// `base: './'` makes every asset path relative; index.html carries <base href="/"> so deep
// SPA-fallback URLs (/admin/catalog/KO-1001) still resolve assets. A node mounted under a
// sub-path only rewrites that one tag (see README "For node implementers").
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss(), ...(mode === 'mock' ? [] : [thirdPartyNotices()])],
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
