import { defineConfig, type ResolvedConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { generateSitemap } from "./scripts/generate-sitemap";
import { generateLlmsFull } from "./scripts/generate-llms-full";
import { prerenderSeoHtml } from "./scripts/prerender";
import { verifyPrerenderedSeo } from "./scripts/verify-prerender";

function smartySeoPrerenderPlugin() {
  let outDir = path.resolve(__dirname, "dist");

  return {
    name: "smarty-seo-prerender",
    apply: "build" as const,
    configResolved(config: ResolvedConfig) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await prerenderSeoHtml({ distDir: outDir });
      await generateSitemap([
        path.resolve(__dirname, "public/sitemap.xml"),
        path.join(outDir, "sitemap.xml"),
      ]);
      await generateLlmsFull([
        path.resolve(__dirname, "public/llms-full.txt"),
        path.join(outDir, "llms-full.txt"),
      ]);
      await verifyPrerenderedSeo({ distDir: outDir });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    smartySeoPrerenderPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      strategies: "generateSW",
      devOptions: { enabled: false },
      includeAssets: [
        "favicon.ico",
        "robots.txt",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable-192.png",
        "icon-maskable-512.png",
      ],
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/payment-success/,
          /^\/api\//,
          /^\/functions\//,
        ],
        globPatterns: ["**/*.{js,css,woff2,ico,webmanifest}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-pages",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/assets\/.*\.(?:js|css|woff2?)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|webp|avif|gif|svg)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-rest",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-storage",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
