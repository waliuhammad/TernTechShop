import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },

  // Absolute base. A relative base ('./') would break client-side routing:
  // index.html served at /product/abc would resolve './assets/…' to
  // /product/assets/… and 404. Deploying to a Hostinger SUBFOLDER instead of
  // public_html? Build with: VITE_BASE=/subfolder/ npm run build
  base: process.env.VITE_BASE ?? '/',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    // Hostinger shared hosting serves these directly; keep chunks modest.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing vendors so repeat visitors only
        // re-download application code.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id))
            return 'react';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils'))
            return 'motion';
          if (id.includes('lucide-react')) return 'icons';
          return undefined;
        },
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },

  server: { port: 5173, open: false },
  preview: { port: 4173 },
});
