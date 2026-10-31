import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// `base` is relative so the build works on GitHub Pages under /cutie_counter/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 800 }, // React + TipTap is ~210 KB gzipped; fine for one page
  test: {
    environment: 'node',
  },
})
