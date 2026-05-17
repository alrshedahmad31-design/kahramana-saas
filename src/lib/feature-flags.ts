/**
 * Centralised feature-flag map.
 *
 * Flags are read once at module load; bundling `NEXT_PUBLIC_*` vars at build
 * time means each deployment has a fixed flag state. Toggling requires a redeploy.
 */

// Activate when staff accounts go live: set NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN=true in Vercel.
export const ENABLE_QR_LOYALTY_SCAN =
  process.env.NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN === 'true'
