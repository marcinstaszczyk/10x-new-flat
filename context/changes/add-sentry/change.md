---
change_id: add-sentry
title: Add Sentry error reporting
status: new
created: 2026-06-10
updated: 2026-06-10
archived_at: null
---

## Notes

Add Sentry to project. I want `error` and `warn` production errors to go to Sentry.
I have following hint:
Note - Astro 6 on Cloudflare: Astro 6 requires the @astrojs/cloudflare adapter version 13+, which integrates with Cloudflare via a custom entry point. Since @sentry/astro 10.44.0 (issue #19762), this path is supported - and this is exactly the configuration for 10xCards (Astro 6.3.1, deploy on Workers). Instead of the adapter's default entry point, you specify your own file in wrangler.toml, which wraps the Astro handler in Sentry:
```
# wrangler.toml
main = "./sentry.server.config.ts"  # zamiast "@astrojs/cloudflare/entrypoints/server"

// sentry.server.config.ts
import * as Sentry from "@sentry/cloudflare";
import handler from "@astrojs/cloudflare/entrypoints/server";

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    // przekaz console.warn / console.error do Sentry jako zdarzenia
    integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
  }),
  handler,
);
```
