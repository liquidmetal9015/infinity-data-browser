import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'


// https://vite.dev/config/
export default defineConfig({
  base: '/infinity-data-browser/',
  plugins: [react()],
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
    ],
  },
})
