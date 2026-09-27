import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { codeToHtml, type ThemeRegistration } from "shiki";
import { INSTALL, USAGE } from "./demo/code";

// greys only: structure reads through weight of tone, not hue
const mono: ThemeRegistration = {
  name: "mono",
  type: "dark",
  colors: { "editor.background": "#00000000", "editor.foreground": "#d4d4d4" },
  tokenColors: [
    { scope: ["comment"], settings: { foreground: "#5a5a5a", fontStyle: "italic" } },
    { scope: ["keyword", "storage", "keyword.control", "keyword.operator"], settings: { foreground: "#7c7c7c" } },
    { scope: ["punctuation", "meta.brace", "punctuation.definition.tag", "punctuation.section"], settings: { foreground: "#626262" } },
    { scope: ["string", "string.quoted"], settings: { foreground: "#a3a3a3" } },
    { scope: ["entity.name.tag", "support.class.component", "entity.name.type", "support.class"], settings: { foreground: "#f0f0f0" } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "#9b9b9b" } },
    { scope: ["entity.name.function", "support.function", "variable.function"], settings: { foreground: "#e2e2e2" } },
    { scope: ["variable", "variable.other", "meta.jsx.children"], settings: { foreground: "#c8c8c8" } },
  ],
};

// highlight the landing-page snippets at build time: the page ships HTML, not a highlighter
const code = (): Plugin => ({
  name: "monochord-code",
  resolveId: (id) => (id === "virtual:code" ? "\0virtual:code" : undefined),
  async load(id) {
    if (id !== "\0virtual:code") return;
    const [install, usage] = await Promise.all([
      codeToHtml(INSTALL, { lang: "shellscript", theme: mono }),
      codeToHtml(USAGE, { lang: "tsx", theme: mono }),
    ]);
    return `export const install = ${JSON.stringify(install)};\nexport const usage = ${JSON.stringify(usage)};`;
  },
});

// the demo site; the library itself builds with tsc (npm run build)
export default defineConfig({ plugins: [react(), code()], build: { outDir: "site" } });
