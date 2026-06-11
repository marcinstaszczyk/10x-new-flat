import * as Sentry from "@sentry/astro";

const publicSentryDsn = import.meta.env.PUBLIC_SENTRY_DSN as unknown;
const dsn = typeof publicSentryDsn === "string" && publicSentryDsn.length > 0 ? publicSentryDsn : undefined;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
});
