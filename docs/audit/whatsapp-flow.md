# WHATSAPP ORDER FLOW — Current State
> Phase 0 Audit | Date: 2026-04-27
> Documents the existing order flow before Phase 1 rebuild.

---

## 1. Current Order Flow (As-Is)

```
Customer visits kahramanat.com
        │
        ▼
Browses /menu page
(sees dish names + descriptions, 95% of images broken)
        │
        ▼
Clicks "اطلب" button (navbar) or "اطلب الآن" (floating button)
        │
        ├─── Single "اطلب" button → wa.me/97317131413 (Riffa — default)
        │
        ├─── On menu page, branch selector appears:
        │    ├── "Riffa"    → wa.me/97317131413?text=Hello%2C%20I%27d%20like%20to%20order%20from%20Kahramana%20Riffa
        │    └── "Muharraq" → wa.me/97317131213?text=Hello%2C%20I%27d%20like%20to%20order%20from%20Kahramana%20Muharraq
        │
        ▼
WhatsApp opens with pre-filled message (ENGLISH only):
"Hello, I'd like to order from Kahramana [Branch]"
        │
        ▼
Customer manually types order in Arabic or English:
"ابي كباب لحم + قوزي + عصير تفاح"
(no structure, no quantities, no modifiers)
        │
        ▼
Message sent to restaurant WhatsApp
        │
        ▼
Restaurant staff reads manually
(no notification system, no order tracking)
        │
        ▼
Staff replies to confirm / ask clarifying questions
        │
        ▼
Order prepared
        │
        ▼
Delivery / pickup — no tracking, no ETA
```

---

## 2. WhatsApp Numbers Confirmed

| Branch | Number | wa.me Link |
|---|---|---|
| الرفاع — الحجيات | +973 1713 1413 | `https://wa.me/97317131413` |
| المحرق — قلالي | +973 1713 1213 | `https://wa.me/97317131213` |

---

## 3. Current Pre-Filled Messages (Phase 1 Must Improve)

```
General:  "Hello, I'd like to order from Kahramana"
Riffa:    "Hello, I'd like to order from Kahramana Riffa"
Muharraq: "Hello, I'd like to order from Kahramana Muharraq"
```

**Problems with current messages:**
- English only — primary audience is Arabic-speaking
- No structured order format — customer starts from blank text
- No branch address or pickup/delivery question
- No time/ETA request
- No order reference number

---

## 4. Phase 1 Improved wa.me Flow

Phase 1 replaces the random WhatsApp with a structured checkout that sends a formatted order summary. The wa.me link becomes a fallback, not the primary mechanism.

### 4.1 — Structured Order Message (Phase 1 Output)

```
طلب جديد من كهرمانة بغداد Receipt:
━━━━━━━━━━━━━━━━━━━━━━━
الفرع: الرفاع — الحجيات
نوع الطلب: توصيل

الأصناف:
• كباب لحم × 2 — 3.200 BD
• قوزي لحم × 1 — 8.500 BD
• عصير تفاح × 2 — 1.500 BD
━━━━━━━━━━━━━━━━━━━━━━━
الإجمالي: 16.400 BD
━━━━━━━━━━━━━━━━━━━━━━━
الاسم: [Customer Name]
رقم التواصل: [Phone]
العنوان: [if delivery]
ملاحظات: [notes]
━━━━━━━━━━━━━━━━━━━━━━━
رقم الطلب: #KH-2025-0042
```

### 4.2 — Phase 1 wa.me URL Construction

```typescript
// lib/whatsapp/buildOrderMessage.ts
export function buildOrderMessage(order: Order): string {
  const lines = [
    `طلب جديد من كهرمانة بغداد Receipt:`,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `الفرع: ${order.branch.nameAR}`,
    `نوع الطلب: ${order.type === 'delivery' ? 'توصيل' : 'استلام من الفرع'}`,
    ``,
    `الأصناف:`,
    ...order.items.map(i => `• ${i.nameAR} × ${i.qty} — ${(i.price * i.qty).toFixed(3)} BD`),
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `الإجمالي: ${order.total.toFixed(3)} BD`,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `الاسم: ${order.customer.name || '—'}`,
    `رقم التواصل: ${order.customer.phone || '—'}`,
    order.type === 'delivery' ? `العنوان: ${order.address || '—'}` : null,
    order.notes ? `ملاحظات: ${order.notes}` : null,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `رقم الطلب: #${order.ref}`,
  ].filter(Boolean).join('\n')

  const waNumber = order.branch.whatsappNumber // from Supabase env var
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(lines)}`
}
```

---

## 5. Phase 1 Order Flow (To-Be)

```
Customer visits kahramanat.com
        │
        ▼
Browses menu (items from Sanity CMS, all images loading)
        │
        ▼
Adds items to cart (drawer opens)
        │
        ▼
Clicks "إتمام الطلب" → Checkout page
Fields: Name, Phone (optional), Branch, Delivery/Pickup, Notes
        │
        ▼
Confirms order
        │
        ├── Record created in Supabase orders table
        │
        └── WhatsApp opens with structured message
            → Sent to branch-specific number
        │
        ▼
Restaurant staff sees order in Dashboard
(New order notification + full details)
        │
        ▼
Staff updates status: New → Accepted → Preparing → Ready
        │
        ▼
Customer gets no automated notification in Phase 1
(manual callback via the phone number they provided)
```

---

## 6. Current Pain Points Documented

| Pain Point | Severity | Phase 1 Fix |
|---|---|---|
| No order structure — customer types freeform | Critical Critical | Structured checkout form |
| English-only pre-filled message | Critical Critical | Arabic-first message |
| Default button goes to Riffa regardless of customer location | Medium Medium | Branch selector at checkout |
| No order reference number | Medium Medium | Auto-generated `#KH-YYYY-NNNN` |
| No customer name/phone captured | Medium Medium | Optional checkout fields |
| Staff must manually parse WhatsApp chat for each order | Medium Medium | Dashboard shows structured order |
| No order history for customer | Medium Medium | Phase 5 (loyalty) |
| No ETA or delivery tracking | Medium Medium | Phase 4 (driver PWA) |
| No payment — cash on delivery only | Medium Medium | Phase 6 (Benefit Pay) |
| Orders mixed with general WhatsApp messages | Medium Medium | Dedicated business WhatsApp numbers |

---

## 7. WhatsApp Numbers — Storage Rule (Phase 1)

WhatsApp numbers must NEVER be hardcoded. Store in Supabase `branches` table:

```sql
-- Supabase branches table (Phase 1)
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  whatsapp_number text NOT NULL, -- e.g. '97317131413'
  phone text NOT NULL,
  address_ar text,
  address_en text,
  opens_at time,
  closes_at time,
  is_active boolean DEFAULT true
);
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
```

---

## 8. Third-Party Ordering Platforms

Confirmed on current site:

| Platform | URL | Integration Phase |
|---|---|---|
| Talabat | talabat.com | Phase 7 (Deliverect) |
| Keeta | mykeeta.com | Phase 7 (Deliverect) |

In Phase 1: external links to these platforms remain as-is. Full integration (orders appearing in Dashboard) happens in Phase 7 via Deliverect.
