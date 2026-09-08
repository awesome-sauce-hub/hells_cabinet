import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Content lives outside src/ and is imported as JSON by the app.
  resolve: { preserveSymlinks: true },
})
