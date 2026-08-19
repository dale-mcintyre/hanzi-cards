import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('hanzi-writer')) return 'vendor-hanzi-writer';
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react';
        },
      },
    },
  },
})
