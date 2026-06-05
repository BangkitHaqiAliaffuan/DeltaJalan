// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
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
          icons: [
            { src: "/logo.png", sizes: "248x247", type: "image/png" },
          ],
        },
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        },
      }),
    ],
    server: {
      host: true,
      port: 5173, // Frontend dev server di port 3000 (Laravel pakai 8080)
      strictPort: true, // Gagal jika port 3000 sudah dipakai, jangan auto-increment
      allowedHosts: ["70ab-103-216-221-86.ngrok-free.app"], // Mengizinkan ngrok menembus pengaman host
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
