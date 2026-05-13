// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://9b5e98391a7e153c05562dfd5cebbb29@o4511364423352320.ingest.us.sentry.io/4511364426170368",

  // Sanitized release name — short SHA only, no full commit hash exposed in event payloads.
  release: process.env.VERCEL_GIT_COMMIT_REF
    ? `kahramana-${process.env.VERCEL_GIT_COMMIT_REF}-${(process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7)}`
    : undefined,

  // 10% trace sampling — production-appropriate; full sampling burns Sentry quota.
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Disable PII auto-capture (was true) — Sentry was auto-collecting client IPs
  // and cookies on every server event. We attach user context explicitly where
  // it's actually needed (e.g. registerAction) instead of leaking it everywhere.
  sendDefaultPii: false,
});
