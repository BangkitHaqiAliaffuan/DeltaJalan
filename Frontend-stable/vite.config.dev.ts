import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

function injectLeafletGlobalPlugin() {
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

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    injectLeafletGlobalPlugin(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
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
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/",
        navigateFallbackAllowlist: [/^(?!\/api\/).*/],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ["empty-feet-grab.loca.lt ","magnetize-divisibly-humorous.ngrok-free.dev"],
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
});
