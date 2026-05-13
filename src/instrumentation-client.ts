// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sanitized release name — avoids leaking the full commit SHA into client bundles.
  // Falls back to undefined locally so dev events aren't bucketed under a fake release.
  release: process.env.VERCEL_GIT_COMMIT_REF
    ? `kahramana-${process.env.VERCEL_GIT_COMMIT_REF}-${(process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7)}`
    : undefined,

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // 10% trace sampling — production-appropriate; full sampling burns Sentry quota.
  tracesSampleRate: 0.1,
  // Restrict trace propagation (sentry-trace + baggage headers) to internal API routes only.
  // Prevents org_id / release SHA from leaking into HTML meta tags and third-party requests.
  tracePropagationTargets: [/^\/api\//],
  enableLogs: false,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Aligned with sentry.server.config.ts — do not auto-collect PII (IPs, cookies, headers).
  // Attach user context explicitly at the call sites that actually need it.
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
