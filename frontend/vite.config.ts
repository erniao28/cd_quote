import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  base: '/auto-quote/',
  server: { port: 5174, host: true, open: false },
  build: { outDir: 'dist', sourcemap: false }
})
