// @ts-check
import { defineConfig, envField } from "astro/config";

import solid from "@astrojs/solid-js";
import sitemap from "@astrojs/sitemap";
import sentry from "@sentry/astro";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [solid(), sitemap(), sentry({ telemetry: false, sourcemaps: { disable: true } })],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENROUTER_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENROUTER_MODEL: envField.string({ context: "server", access: "secret", optional: true }),
      E2E_OPENROUTER_MOCK: envField.string({ context: "server", access: "secret", optional: true }),
      SENTRY_DSN: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
