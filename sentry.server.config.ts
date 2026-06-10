import handler from "@astrojs/cloudflare/entrypoints/server";
import * as Sentry from "@sentry/cloudflare";

interface SentryEnv {
  SENTRY_DSN?: string;
}

export default Sentry.withSentry(
  (env: SentryEnv) => ({
    dsn: env.SENTRY_DSN,
    enabled: Boolean(env.SENTRY_DSN),
    integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
  }),
  handler,
);
