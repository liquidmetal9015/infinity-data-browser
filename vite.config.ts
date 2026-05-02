import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'


// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    exclude: [
      'ai-tmp/**',
      'e2e/**',
      'mcp-server/**',
      'node_modules/**',
      '**/node_modules/**',
      'backend-ts/**',
    ],
  },
})
