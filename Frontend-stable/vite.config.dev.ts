import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

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
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ["magnetize-divisibly-humorous.ngrok-free.dev"],
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
