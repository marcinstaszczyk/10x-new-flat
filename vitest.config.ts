import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const srcDir = fileURLToPath(new URL("./src", import.meta.url));
const astroEnvServerStub = fileURLToPath(new URL("./src/test/stubs/astro-env-server.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": srcDir,
      "astro:env/server": astroEnvServerStub,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**", "context/archive/**"],
    passWithNoTests: true,
    root: rootDir,
  },
});
