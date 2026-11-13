import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "dev"),
    __COMMIT_SHA__: JSON.stringify(process.env.COMMIT_SHA || "local"),
  },
});
