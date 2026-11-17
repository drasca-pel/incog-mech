import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // './' makes the built files find each other by relative paths.
  // The installed desktop app opens them from a folder on disk, where '/assets/...' would not be found.
  base: './',
})
