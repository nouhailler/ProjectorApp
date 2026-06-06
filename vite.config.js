import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/shots/**', 'assets/favicon-32.png'],
      manifest: {
        name:             'ProjectorApp',
        short_name:       'Projector',
        description:      'Portfolio éditorial — projets GitHub de @nouhailler',
        start_url:        '/',
        display:          'standalone',
        orientation:      'portrait',
        background_color: '#F4EFE6',
        theme_color:      '#1B1815',
        lang:             'fr',
        icons: [
          { src: 'assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Pré-cache : bundles JS/CSS/HTML générés par Vite + assets locaux
        globPatterns: ['**/*.{js,css,html,png,gif,woff2}'],
        // API tierces : toujours réseau, jamais en cache
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(api\.github\.com|raw\.githubusercontent\.com|openrouter\.ai|api\.anthropic\.com)\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'cdn-cache' },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  },
});
