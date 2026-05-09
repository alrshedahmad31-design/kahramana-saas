# LAST-SESSION.md — Kahramana Baghdad

> **Session**: 76 (Claude Code track)
> **Date**: 2026-05-09
> **Focus**: SaaS readiness audit + 5 competitive-gap closures vs Toast/Square

## Session commit
`c1f6600` — "feat: image upload, offline POS queue, menu modifiers, ESC/POS receipt, configurable loyalty" — pushed to master ✅

## What was done

### Phase 1 — SaaS readiness audit
Spawned a thorough investigation agent over the full codebase + 80+ migrations to score the platform across 10 dimensions vs Toast / Square benchmarks. Verdict: **3/10 overall** — a polished, security-hardened single-restaurant operations app, **not a SaaS**. Operational core (inventory, KDS, driver, loyalty, RLS) is genuinely competitive; SaaS layer (multi-tenancy, billing, onboarding, brand abstraction, hardware, offline POS) does not exist.

Strongest scores: Reporting 7/10, Staff/Scheduling 5/10, Payments 4/10. Floor scores: Multi-tenancy 1/10, Integrations 1/10, Hardware 1/10, SaaS infra 1/10.

### Phase 2 — Closed 5 competitive gaps

| Gap | Migration(s) | Key files |
|---|---|---|
| 1. Image upload | `081_menu_images_storage.sql` | `MenuImageInput.tsx`, `uploadMenuImage` action — file picker + Canvas WebP + 2 MB Supabase Storage upload |
| 2. Offline POS queue | — (IndexedDB-only) | `offline-db.ts` (DB v2 + `pending_pos_orders`), `POSClient.tsx` online/offline banner + auto-flush + idempotency-keyed retries |
| 3. Menu modifiers | `082_menu_modifiers.sql`, `083_rpc_create_order_modifiers.sql` | `ModifiersEditor.tsx`, `ModifierPicker.tsx`, server-side modifier price validation in `pos/actions.ts`, `order_items.modifiers` JSONB |
| 4. ESC/POS receipt | — | `lib/hardware/receipt-printer.ts` (WebUSB Epson/Star/Bixolon/Citizen + HTML 80mm fallback), `PrintReceiptButton.tsx` |
| 5. Loyalty config from DB | `084_loyalty_config.sql` | `lib/loyalty/config.ts` (`getLoyaltyConfig` + `unstable_cache` 60s + `revalidateTag`), `LoyaltySettings.tsx`, checkout/actions.ts now reads from DB |

### Migration sweep
Discovered 077–080 (prior session's menu-CRUD/KDS fixes) had never reached production. Pushed all 8 migrations (077–084) in a single batch via `npx supabase db push --linked --include-all`.

### Build & deploy
- TSC: **0 errors**
- Production build: **green** (Vercel auto-deploy in flight after push)
- Local Windows build needed `NEXT_BUILD_WORKERS=1` to avoid a flaky parallel-page-collection race in Next 15.5.15 — Vercel Linux is unaffected

## Issues hit & fixed mid-flight

1. **`staff_basic.user_id` does not exist** — column is `id`. Migrations 082 + 084 RLS policies failed on first push; fixed and re-applied. Future RLS migrations: use `WHERE staff_basic.id = auth.uid()`.
2. **`Database` type lag** — new tables `menu_option_groups`, `menu_options`, `loyalty_config` aren't in the regenerated typed client. Used a small `untypedServiceClient()` helper (plain `createClient` from `@supabase/supabase-js` with no `Database` generic) for those calls. Drop the helper after running `npx supabase gen types`.
3. **`USBDevice` types missing** — added inline ambient declarations at the top of `receipt-printer.ts` instead of installing `@types/w3c-web-usb`.

## Decisions made

- Modifiers in POS: extended the existing VariantPicker → ModifierPicker chain rather than a single combined modal — clearer separation between size/variant picking (already present in menu data) and modifier picking (new server-driven feature).
- Modifier price integrity: server-side validates each submitted `option_id` against `menu_options.price_modifier`, rejects unknown/unavailable options, and **replaces** the client-submitted price with the DB value before computing the order total. Patch to `rpc_create_order` (083) skips the existing `PRICE_MISMATCH` check when the line carries modifiers.
- Loyalty constants: kept legacy exports in `lib/loyalty/calculations.ts` for client-side display compatibility; only **server-side security paths** (checkout points-redemption gate) were migrated to `getLoyaltyConfig()`. Settings UI writes through `revalidateTag('loyalty-config')`.

## What's next

### Untouched / deferred (cosmetic)
- **Cart-line UI in `OrderBuilder.tsx`** doesn't yet display selected modifiers — they flow through invisibly to the receipt and `order_items.modifiers`. Visual surfacing is polish.
- Settings → Loyalty: per-branch overrides not yet exposed in UI (table column exists, only global row is editable).

### When `Database` types are regenerated
Drop the `untypedServiceClient()` helper in `src/app/[locale]/dashboard/menu/actions.ts` and `src/app/[locale]/dashboard/pos/page.tsx` and inline `as unknown as DbRow` cast in `src/lib/loyalty/config.ts`.

### Strategic recommendation surfaced by the audit
If Kahramana is to be resold as a SaaS, P0 work is **multi-tenant schema migration** (`restaurant_id` on every domain table + RLS rewrite + brand abstraction + tenant provisioning + Stripe Connect billing). That's a 3–6 month re-foundation, not a refactor. The audit doc with full P0/P1/P2 roadmap is in this turn's chat history — copy to `docs/audit/saas-readiness-2026-05-09.md` if you want it persisted.
