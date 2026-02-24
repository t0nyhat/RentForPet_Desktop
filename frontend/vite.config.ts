import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: './',

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@context": path.resolve(__dirname, "./src/context"),
      "@constants": path.resolve(__dirname, "./src/constants"),
    },
  },

  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5226",
        changeOrigin: true,
      },
      "/hubs": {
        target: "http://localhost:5226",
        changeOrigin: true,
        ws: true,
      },
    },
  },

  build: {
    // Optimize build output
    target: "es2020",
    minify: "esbuild",

    // Esbuild options for minification
    esbuild: {
      drop: ["console", "debugger"],
    },

    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Simplify code splitting - all node_modules in one vendor chunk
          // This prevents React loading issues in production
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },

        // Optimize chunk file names
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
      },
    },

    // Chunk size warning limit
    chunkSizeWarningLimit: 1000,

    // Enable source maps for production debugging (optional)
    sourcemap: false,
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom"],
  },
});
