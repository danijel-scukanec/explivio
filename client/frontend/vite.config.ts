import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // In this npm workspace, react/react-dom are hoisted to client/node_modules. Dedupe so Vite (and
  // its dep optimizer, when bundling react-leaflet) resolves a single copy — otherwise the optimizer
  // looks for react-dom under frontend/node_modules and fails with ENOENT.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['@explivio/shared', 'react-leaflet', 'leaflet'],
  },
})
