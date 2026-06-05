import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const alias = {
  "@":           path.resolve(__dirname, "src"),
  "@core":       path.resolve(__dirname, "src/core"),
  "@store":      path.resolve(__dirname, "src/store"),
  "@components": path.resolve(__dirname, "src/components"),
  "@services":   path.resolve(__dirname, "src/services"),
  "@shared":     path.resolve(__dirname, "src/shared"),
  "@utils":      path.resolve(__dirname, "src/utils"),
};

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: { alias },

  optimizeDeps: {
    exclude: ["@monaco-editor/react"],
    include: ["react", "react-dom", "zustand", "react-resizable-panels", "lucide-react"],
  },

  worker: { format: "es" },

  build: {
    chunkSizeWarningLimit: 2000,
    target: "esnext",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("monaco-editor") || id.includes("@monaco-editor")) return "monaco";
          if (id.includes("@xterm")) return "xterm";
          if (id.includes("react-dom") || id.includes("react/")) return "react-vendor";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },

  server: { port: 5173, strictPort: false },

  // Vitest config
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["src/test/**", "src/main.tsx"],
    },
  },
} as Parameters<typeof defineConfig>[0]);
