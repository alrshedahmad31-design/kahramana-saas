// Shared phone-input regex for public form validation.
//
// Permissive on purpose — handles user-entered values with spaces, dashes,
// and parentheses before the post-validation normalizer pins them to a
// Bahrain canonical (+9738xxxxxxx). Tighter shape checks live downstream
// (e.g. normalizePhone in account/login/actions.ts).
//
// Centralized here so a future tightening (e.g. requiring a leading +
// or rejecting consecutive separators) propagates to contact, reserve,
// and catering in one edit instead of three.
export const PUBLIC_PHONE_RE = /^[\d +\-()+]{7,30}$/
