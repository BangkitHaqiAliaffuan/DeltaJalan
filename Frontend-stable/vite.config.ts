// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Injects `import L from 'leaflet'` into the leaflet.markercluster UMD bundle.
// The plugin references the global `L` variable inside its factory body without declaring
// it — in Vite's ESM/CJS transform pipeline the global is never defined, causing
// "ReferenceError: L is not defined". This transform patches that at build time.
function injectLeafletGlobalPlugin(): Plugin {
  return {
    name: "inject-leaflet-for-markercluster",
    transform(code: string, id: string) {
      if (id.includes("leaflet.markercluster") && id.endsWith(".js")) {
        return {
          code: `import L from 'leaflet';\n` + code,
          map: null,
        };
      }
    },
  };
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  plugins: [
    injectLeafletGlobalPlugin(),
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "DeltaJalan - Sistem Pelaporan Kerusakan Jalan",
        short_name: "DeltaJalan",
        description: "Sistem pelaporan dan penanganan kerusakan jalan",
        theme_color: "#2563EB",
        background_color: "#FFFFFF",
        display: "standalone",
        scope: "/",
        start_url: "/",
        lang: "id",
        icons: [
          { src: "/logo.png", sizes: "248x247", type: "image/png" },
          { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/",
        navigateFallbackAllowlist: [/^(?!\/api\/).*/],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-v1",
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-v1",
              expiration: { maxEntries: 200, maxAgeSeconds: 2592000 },
            },
          },
          {
            urlPattern: /\.(?:js|css|woff2?|ttf|eot)$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-v1",
              expiration: { maxEntries: 100, maxAgeSeconds: 2592000 },
            },
          },
          {
            urlPattern: /(?:tile\.openstreetmap|unpkg|cdn\.jsdelivr|fonts\.(?:googleapis|gstaticache))\./,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "cdn-v1",
              expiration: { maxEntries: 200 },
            },
          },
        ],

      },
    }),
  ],
  vite: {
    server: {
      host: true,
      port: 5173, // Frontend dev server di port 3000 (Laravel pakai 8080)
      strictPort: true, // Gagal jika port 3000 sudah dipakai, jangan auto-increment
      allowedHosts: ["magnetize-divisibly-humorous.ngrok-free.dev"], // Mengizinkan ngrok menembus pengaman host
      // Proxy /api/* ke Laravel backend (port 8080)
      // Ini menghindari CORS karena request diteruskan server-to-server oleh Vite
      proxy: {
        "/api": {
          target: "http://localhost:8080",
          changeOrigin: true,
          secure: false,
        },
        "/storage": {
          target: "http://localhost:8080",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
});
