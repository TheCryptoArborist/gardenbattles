import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { copyFile, mkdir } from "node:fs/promises";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

function emitSpaRouteEntries(routes: string[]): Plugin {
  return {
    name: "emit-spa-route-entries",
    apply: "build" as const,
    async writeBundle(options) {
      if (!options.dir) {
        throw new Error("Garden Battles build output directory is unavailable.");
      }

      const source = path.join(options.dir, "index.html");

      await Promise.all(
        routes.map(async (route) => {
          const routeDir = path.join(options.dir!, route);
          await mkdir(routeDir, { recursive: true });
          await copyFile(source, path.join(routeDir, "index.html"));
        }),
      );
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    emitSpaRouteEntries(["leaderboard", "trials"]),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "battle-gardenfrontend", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "battle-gardenfrontend"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/socket.io": {
        target: "http://localhost:5000",
        ws: true,
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
