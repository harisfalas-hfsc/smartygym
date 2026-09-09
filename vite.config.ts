import { defineConfig, type ResolvedConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
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
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
