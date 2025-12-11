import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'


// https://vite.dev/config/
export default defineConfig({
  base: '/infinity-data-browser/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
})
