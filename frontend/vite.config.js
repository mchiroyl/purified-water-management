import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'prompt',
            includeAssets: ['icons/icon.svg'],
            manifest: {
                name: 'Sistema Agua Pura',
                short_name: 'Agua Pura',
                description: 'Control digital de ventas, rutas, inventario y liquidaciones',
                theme_color: '#087e8b',
                background_color: '#f4fbfc',
                display: 'standalone',
                start_url: '/',
                scope: '/',
                lang: 'es-GT',
                icons: [
                    {
                        src: '/icons/icon.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'any maskable'
                    }
                ]
            },
            workbox: {
                navigateFallback: '/index.html',
                runtimeCaching: [
                    {
                        urlPattern: ({ request }) => request.destination === 'document',
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'app-pages',
                            networkTimeoutSeconds: 4
                        }
                    }
                ]
            }
        })
    ],
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:8080',
            '/actuator': 'http://localhost:8080'
        }
    },
    test: {
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        globals: true,
        css: true
    }
});
