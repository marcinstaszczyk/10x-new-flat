---
change_id: add-sentry
title: Add Sentry error reporting
status: new
created: 2026-06-10
updated: 2026-06-11
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

### Information from Sentry site

#### Configure SDK

Configure the Sentry integration in your astro.config.mjs file:

```
// astro.config.mjs
import { defineConfig } from "astro/config";
import sentry from "@sentry/astro";

export default defineConfig({
  integrations: [
    sentry({
      project: "javascript-astro",
      org: "marcin-staszczyk",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});
```

Create a sentry.client.config.js file in the root of your project to configure the client-side SDK:

```
// sentry.client.config.js
import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: env.SENTRY_DSN,
  // To disable sending user data, uncomment the line below. For more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/astro/configuration/options/#dataCollection
  // dataCollection: { userInfo: false },
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  // Enable logs to be sent to Sentry
  enableLogs: true,
  // Define how likely traces are sampled. Adjust this value in production,
  // or use tracesSampler for greater control.
  tracesSampleRate: 1.0,
});
```

Create a sentry.server.config.js file in the root of your project to configure the server-side SDK:

```
// sentry.server.config.js
import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: env.SENTRY_DSN,
  // To disable sending user data, uncomment the line below. For more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/astro/configuration/options/#dataCollection
  // dataCollection: { userInfo: false },
  // Enable logs to be sent to Sentry
  enableLogs: true,
  // Define how likely traces are sampled. Adjust this value in production,
  // or use tracesSampler for greater control.
  tracesSampleRate: 1.0,
});
```

Verify
Then throw a test error anywhere in your app, so you can test that everything is working:

```
<!-- your-page.astro -->
---
---
<button id="error-button">Throw test error</button>
<script>
  import * as Sentry from "@sentry/astro";
  function handleClick () {
    // Send a log before throwing the error
    Sentry.logger.info(Sentry.logger.fmt`User ${"sentry-test"} triggered test error button`, {
      action: "test_error_button_click",
    });
    // Send a test metric before throwing the error
    Sentry.metrics.count('test_counter', 1);
    throw new Error('This is a test error');
  }
  document.querySelector("#error-button").addEventListener("click", handleClick);
</script>
```
