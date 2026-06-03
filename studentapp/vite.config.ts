import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/bridge-api": {
        target: "http://127.0.0.1:3001/api",
        rewrite: (p) => p.replace(/^\/bridge-api/, ""),
        changeOrigin: true,
      },
    },
  },
})
