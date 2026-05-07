# Loyalty Redemption — Integration Diffs
# Apply these changes to existing files

---

## 1. src/components/checkout/CheckoutForm.tsx

### Add import
```ts
import { LoyaltyRedemptionWidget } from '@/components/loyalty/LoyaltyRedemptionWidget'
import { MIN_REDEMPTION, pointsToCredit } from '@/lib/loyalty/calculations'
```

### Replace existing loyalty toggle JSX with:
```tsx
{/* Step N — Loyalty Points */}
{customerProfile && customerProfile.points_balance >= MIN_REDEMPTION && (
  <section aria-labelledby="loyalty-heading">
    <h2 id="loyalty-heading" className="mb-3 text-sm font-semibold text-brand-text-muted">
      {t('checkout.loyalty.heading')}
    </h2>
    <LoyaltyRedemptionWidget
      pointsBalance={customerProfile.points_balance}
      isActive={usePoints}
      onToggle={setUsePoints}
      locale={locale}
      t={t}
    />
  </section>
)}
```

### Ensure pointsDiscount is computed as:
```ts
const pointsDiscount = usePoints ? pointsToCredit(customerProfile?.points_balance ?? 0) : 0
```
(Verify this line exists; add before finalTotal calculation if missing)

---

## 2. src/app/[locale]/checkout/actions.ts

### In the order insert block (both paths, ~line 590 and ~line 662),
### add the two new columns:

```ts
// BEFORE:
const { data: order, error: orderErr } = await supabase
  .from('orders')
  .insert({
    ...resolvedOrderData,
    status: orderStatus,
    expires_at: expiresAt,
    idempotency_key,
    total_bhd: finalTotal,
  })

// AFTER:
const { data: order, error: orderErr } = await supabase
  .from('orders')
  .insert({
    ...resolvedOrderData,
    status: orderStatus,
    expires_at: expiresAt,
    idempotency_key,
    total_bhd: finalTotal,
    loyalty_points_redeemed: payload.pointsToRedeem ?? 0,
    loyalty_discount_bhd:    pointsDiscount,  // already computed in scope
  })
```

Note: `pointsDiscount` is already in scope in the points path (~line 590).
For the standard path (~line 662), `pointsDiscount` = 0 since `pointsToRedeem` = 0.
Add: `const pointsDiscount = pointsToCredit(payload.pointsToRedeem ?? 0)` at the top of the function.

---

## 3. messages/ar.json — add under "checkout":

```json
"loyalty": {
  "heading": "نقاط المكافآت",
  "balance": "لديك {{count}} نقطة",
  "equivalent": "تعادل {{amount}}",
  "saving": "ستوفر {{amount}} من هذا الطلب",
  "toggle": "تفعيل / إيقاف نقاط المكافآت",
  "needMore": "تحتاج {{count}} نقطة إضافية للاسترداد"
}
```

## 4. messages/en.json — add under "checkout":

```json
"loyalty": {
  "heading": "Loyalty Points",
  "balance": "You have {{count}} points",
  "equivalent": "worth {{amount}}",
  "saving": "You save {{amount}} on this order",
  "toggle": "Toggle loyalty points",
  "needMore": "You need {{count}} more points to redeem"
}
```

---

## 5. After applying migration 061:

```bash
npx supabase gen types typescript --project-id <YOUR_PROJECT_ID> > src/lib/supabase/types.ts
# Strip <claude-code-hint> tag from end of file
```
