import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/auto-quote/',
  server: {
    port: 5174,
    host: true,  // 允许外部访问（部署需要）
    open: false  // 部署时不自动打开
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
