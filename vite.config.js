import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BASE_MANIFEST = {
  name: 'BarbeariaClick',
  short_name: 'BarbeariaClick',
  description: 'Agendamento online, planos mensais e controle simples para barbearias.',
  scope: '/',
  display: 'standalone',
  background_color: '#09090b',
  theme_color: '#09090b',
  icons: [
    {
      src: '/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/maskable-icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/maskable-icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

const SEGMENTOS_RESERVADOS = new Set([
  'admin',
  'api',
  'assets',
  'auth',
  'barbeiro',
  'favicon.ico',
  'login',
  'manifest.webmanifest',
  'master',
  'site.webmanifest',
]);

const normalizarSlugManifest = (valor) => {
  const slug = String(valor || '').replace(/\.webmanifest$/i, '').trim().toLowerCase();
  if (SEGMENTOS_RESERVADOS.has(slug)) return '';
  return /^[a-z0-9-]+$/.test(slug) ? slug : '';
};

const manifestDinamicoPorSlug = () => ({
  name: 'manifest-dinamico-por-slug',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = new URL(String(req.url || '/'), 'http://localhost');
      const matchManifestEstatico = url.pathname.match(/^\/([^/]+)\/site\.webmanifest$/);
      if (matchManifestEstatico) {
        const slug = normalizarSlugManifest(decodeURIComponent(matchManifestEstatico[1]));
        if (!slug) {
          next();
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.end(JSON.stringify({
          ...BASE_MANIFEST,
          id: '.',
          start_url: '.',
        }));
        return;
      }

      next();
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [manifestDinamicoPorSlug(), react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-datepicker') || id.includes('date-fns')) return 'datepicker';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('react') || id.includes('scheduler')) return 'react';
          return 'vendor';
        },
      },
    },
  },
})
