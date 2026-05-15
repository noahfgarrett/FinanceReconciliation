import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string }

// Build modes:
//   npm run build                          → single-file Reconciler.html (default)
//   SINGLE_FILE=0 GH_PAGES=1 npm run build → chunked build for GitHub Pages PWA
const isSingleFile = process.env.SINGLE_FILE !== '0'
const isGhPages = process.env.GH_PAGES === '1'

export default defineConfig({
  plugins: [react(), ...(isSingleFile ? [viteSingleFile()] : [])],
  base: isGhPages ? '/FinanceReconciliation/' : '/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    rollupOptions: {
      output: isSingleFile
        ? { inlineDynamicImports: true, manualChunks: undefined }
        : {},
    },
    chunkSizeWarningLimit: 10000,
  },
})
