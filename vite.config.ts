import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./client', import.meta.url));

export default defineConfig(({ mode }) => ({
  root,
  plugins: [react()],
  resolve: { alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  server: {
    port: 5173,
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] },
    proxy: { '/api': 'http://localhost:4000' },
  },
  // `npm run build:demo` makes a self-contained preview (in-browser backend, relative asset paths).
  base: mode === 'demo' ? './' : '/',
  define: mode === 'demo' ? { 'import.meta.env.VITE_DEMO': JSON.stringify('1') } : {},
  build: {
    outDir: fileURLToPath(new URL(mode === 'demo' ? './dist-demo' : './dist', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: mode === 'demo' ? { output: { inlineDynamicImports: true } } : {},
  },
}));
