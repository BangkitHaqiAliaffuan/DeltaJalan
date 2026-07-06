// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// ────────────────────────────────────────────────────────────────────────────
//  Build environment detection
// ────────────────────────────────────────────────────────────────────────────
const isVercel = process.env.VERCEL === "1";

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

export default defineConfig({
  // Nonaktifkan Cloudflare plugin di Vercel (dikonflik dengan SPA mode)
  cloudflare: !isVercel,

  // Vercel: SPA mode (static output). Local: SSR.
  tanstackStart: isVercel
    ? { spa: { enabled: true } }
    : { server: { entry: "server" } },

  plugins: [
    injectLeafletGlobalPlugin(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      devOptions: { enabled: true },
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
  vite: {
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: ["polite-socks-live.loca.lt"],
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
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes) => {
              proxyRes.headers["Access-Control-Allow-Origin"] = "*";
              proxyRes.headers["Cross-Origin-Resource-Policy"] = "cross-origin";
            });
          },
        },
      },
    },
  },
});
