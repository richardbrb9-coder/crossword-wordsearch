import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'data/*': path.resolve(__dirname, './data/*'),
    },
  },
  server: {
    open: true,
    port: 5200,
    strictPort: true,
  },
  // Include data folder in the bundle
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  // Include data folder in Vite's watch
  watch: {
    included: ['**/*.json'],
  },
})