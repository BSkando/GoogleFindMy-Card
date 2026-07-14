import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'ES2020',
    lib: {
      entry: 'src/googlefindmy-card.ts',
      name: 'GoogleFindMyCardEnhanced',
      fileName: () => 'googlefindmy-card.js',
      formats: ['iife']
    },
    minify: 'terser',
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    }
  },
  server: {
    port: 5173,
    hmr: true
  }
});
