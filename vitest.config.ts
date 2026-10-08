import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

const dir = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths()],
  // vite-tsconfig-paths solo aplica `paths` a los archivos incluidos por
  // tsconfig.json, que excluye `src/**/*.test.ts`; estos alias (los mismos de
  // tsconfig.json) hacen que las pruebas también resuelvan @/, @lago/ y @catalogo/.
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: `${dir("./src/")}$1` },
      { find: /^@lago\/(.*)$/, replacement: `${dir("./lago/")}$1` },
      { find: /^@catalogo\/(.*)$/, replacement: `${dir("./catalogo/")}$1` },
    ],
  },
  // tsconfig.json usa "jsx": "preserve" (Next); las pruebas de render con
  // react-dom/server importan componentes .tsx y necesitan JSX transformado.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
