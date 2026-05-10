# i18n & Font Audit Report — 2026-05-10

| # | Page/File | Locale | Issue Type | Element | Severity | Suggested Fix |
|---|-----------|--------|------------|---------|----------|---------------|
| 1 | `src/app/[locale]/login/page.tsx` | Both | BUG | Language Switcher | B | Fix hydration or routing logic in language switcher component on login page. |
| 2 | `src/app/[locale]/terms/page.tsx` | Both | AR_IN_EN / EN_IN_AR | Entire Content | W | Move all hardcoded strings (titles and body) to `ar.json` and `en.json`. |
| 3 | `src/components/menu/menu-item-card.tsx` | EN | AR_IN_EN | Dish subtitle (Arabic) | W | Add a toggle or logic to hide Arabic names in English locale unless forced. |
| 4 | `src/components/menu/menu-item-card.tsx` | EN | MISSING_DIR | Dish subtitle (Arabic) | W | Add `dir="rtl"` to the Arabic subtitle container when rendered in LTR parent. |
| 5 | `messages/ar.json` | AR | EN_IN_AR | "BD" Currency | W | Standardize on "د.ب" for Arabic and "BHD" for English. Remove "BD". |
| 6 | `src/components/ui/button.tsx` | EN | WRONG_FONT | Button Labels | W | Ensure `font-satoshi` is used for English text instead of `font-almarai`. |
| 7 | `src/app/[locale]/waiter/*.tsx` | Both | AR_IN_EN | Hardcoded labels | W | Extract strings like "طاولة" and "المنيو" to translation files. |
| 8 | `messages/en.json` | EN | AR_IN_EN | `name_ar` field | I | Arabic characters found in English JSON; technically allowed for bilingual data but inconsistent. |
| 9 | `src/middleware.ts` | EN | BUG | Locale Redirection | W | Fix "double locale" issue (e.g., `/en/en/`) observed in some navigation links. |
| 10 | `src/app/globals.css` | EN | WRONG_FONT | Global Fallback | W | `body` has `font-almarai` as default; should switch to Satoshi/Inter for English. |

## Summary Section

### Total Counts
- **Blocker (B):** 1
- **Warning (W):** 7
- **Info (I):** 2

### Top 3 Most Affected Pages
1. **Terms/Privacy Pages:** Entirely hardcoded content, zero i18n implementation.
2. **Menu Page:** Subtitle leakage and currency inconsistency.
3. **Waiter/POS UI:** Heavy use of hardcoded Arabic strings in logic and labels.

### Recommended Fix Order
1. **[B] Language Switcher:** Restore functionality to allow staff access in English.
2. **[W] Terms/Privacy Localization:** Move content to JSON to prevent visual breakage.
3. **[W] Font Standardization:** Fix CSS and component classes to use approved English fonts.
4. **[W] Currency Normalization:** Replace all "BD" instances with localized equivalents.
