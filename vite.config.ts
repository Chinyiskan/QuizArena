import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  root: 'client',
  publicDir: '../public',
  plugins: [react(), tailwind()],
  build: { outDir: '../client-dist', emptyOutDir: true },
  server: {
    host: true,
    allowedHosts: true, // el túnel de Cloudflare entra con otro hostname
    proxy: { '/api': 'http://localhost:3000', '/socket.io': { target: 'http://localhost:3000', ws: true } },
  },
})
