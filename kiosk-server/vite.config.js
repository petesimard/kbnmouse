import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',  // Listen on all interfaces (allows external connections)
    port: 5173
  }
})
