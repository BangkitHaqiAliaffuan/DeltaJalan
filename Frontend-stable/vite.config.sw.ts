import { defineConfig } from "vite";

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    emptyOutDir: false,
    outDir: "public",
    lib: {
      entry: "src/sw.ts",
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        entryFileNames: "sw.js",
        inlineDynamicImports: true,
      },
    },
  },
});
