import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// the demo site; the library itself builds with tsc (npm run build)
export default defineConfig({ plugins: [react()], build: { outDir: "site" } });
