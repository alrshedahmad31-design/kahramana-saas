// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sanitized release name — short SHA only, consistent with server/client init.
  release: process.env.VERCEL_GIT_COMMIT_REF
    ? `kahramana-${process.env.VERCEL_GIT_COMMIT_REF}-${(process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7)}`
    : undefined,

  // 10% trace sampling — aligned with server + client; full sampling burns Sentry quota.
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Aligned with server/client — no automatic PII capture from edge requests.
  sendDefaultPii: false,
});
