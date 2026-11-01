import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./client', import.meta.url));

export default defineConfig(({ mode }) => {
  const isStatic = mode === 'demo' || mode === 'pages';
  return {
  root,
  plugins: [react()],
  resolve: { alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  server: {
    port: 5173,
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] },
    proxy: { '/api': 'http://localhost:4000' },
  },
  // Static builds run the backend rules in the browser (no server):
  //  - `build:demo`  → sandboxed preview page: no outside images, in-memory routing
  //  - `build:pages` → GitHub Pages: real Wikimedia photos, #/hash links that survive refresh
  base: isStatic ? './' : '/',
  define: isStatic
    ? {
        'import.meta.env.VITE_DEMO': JSON.stringify('1'),
        'import.meta.env.VITE_ROUTER': JSON.stringify(mode === 'pages' ? 'hash' : 'memory'),
        'import.meta.env.VITE_PHOTOS_OFF': JSON.stringify(mode === 'demo' ? '1' : ''),
      }
    : {},
  build: {
    outDir: fileURLToPath(new URL(isStatic ? `./dist-${mode}` : './dist', import.meta.url)),
    emptyOutDir: true,
    // The sandboxed preview needs one script; GitHub Pages can lazy-load three.js as its own chunk.
    rollupOptions: mode === 'demo' ? { output: { inlineDynamicImports: true } } : {},
    chunkSizeWarningLimit: 1600,
  },
};
});
