# Feature Inventory — Kahramana Baghdad
> Generated: 2026-05-10 | Branch: master | Commit: bd1cf2c7a5c313bab6d30f1140b955cb1d55f6ab

## Legend
- ✅ مكتمل — كود حقيقي، يعمل
- 🟡 جزئي — موجود لكن ناقص أو stub
- ❌ غائب — غير موجود على الإطلاق
- ⚠️ موجود لكن فيه مشكلة — اذكر المشكلة

## 1. App Routes
| Route | Status | ملاحظة |
|-------|--------|--------|
| `/` (Homepage) | ✅ | Cinematic Hero, Philosophy, Feature Artifacts |
| `/menu` | ✅ | Categories and search (client-side) |
| `/menu/[slug]` | ✅ | Category listing |
| `/menu/item/[slug]` | ✅ | Product detail page with VariantPicker |
| `/about` | ✅ | Story and philosophy |
| `/branches` | ✅ | Branch locations with Maps and hours |
| `/contact` | ✅ | Contact form and social links |
| `/catering` | ✅ | Catering services info |
| `/checkout` | ✅ | Full flow with branch selector and order summary |
| `/order/[id]` | ✅ | Post-checkout tracking and order summary |
| `/dashboard` | ✅ | Multi-role staff panel |
| `/driver` | ✅ | Driver PWA for delivery management |
| `/waiter` | ✅ | Waiter panel for dine-in orders |
| `/table/[branchId]` | ✅ | QR-code based table ordering |
| `/account` | ✅ | Customer loyalty and order history |
| `/login` | ✅ | Staff/Customer auth portal |

## 2. API Endpoints
| Endpoint | Method | Auth | Rate Limit | Status |
|----------|--------|------|------------|--------|
| `/api/health` | GET | No | No | ✅ |
| `/api/inventory/template` | GET | Yes | Yes | ✅ |
| `/api/inventory/export` | GET | Yes | Yes | ✅ |
| `/api/webhooks/tap` | POST | Secret | No | ✅ |
| `/api/orders` | POST | No | Yes | ✅ |

## 3. Database
| الجدول | RLS | ملاحظة |
|--------|-----|--------|
| `branches` | ✅ | Branch details and GPS |
| `orders` | ✅ | Core order data with status and loyalty |
| `order_items` | ✅ | Immutable price snapshots and modifiers |
| `staff_basic` | ✅ | Unified staff table with roles |
| `audit_logs` | ✅ | General action tracking |
| `inventory_ingredients`| ✅ | Core stock tracking |
| `inventory_movements` | ✅ | Stock history and consumption |
| `recipes` | ✅ | BOM for dish-ingredient linking |
| `loyalty_config` | ✅ | DB-driven loyalty rules |
| `promotions` | ✅ | Discount codes and auto-applied promos |
| `restaurant_tables` | ✅ | Table registry for QR/Waiter |
| `shifts` | ✅ | Staff scheduling and clock-ins |
| `cash_handovers` | ✅ | Driver-to-manager reconciliation |
| `payments` | ✅ | Transaction tracking |

## 4. Dashboard Features
| الميزة | Status | الملف | ملاحظة |
|--------|--------|-------|--------|
| Order Management | ✅ | `src/app/[locale]/dashboard/orders/` | View/Update status/Filters |
| Kitchen Display (KDS) | ✅ | `src/app/[locale]/dashboard/kds/` | Real-time board with station routing |
| Staff Management | ✅ | `src/app/[locale]/dashboard/staff/` | RBAC-based creation/roles |
| Inventory Control | ✅ | `src/app/[locale]/dashboard/inventory/` | Stock levels, alerts, Excel import |
| Analytics Dashboard | ✅ | `src/app/[locale]/dashboard/analytics/` | Revenue, orders, and prep times |
| Reporting | ✅ | `src/app/[locale]/dashboard/reports/` | Detailed exports |
| Menu Management | ✅ | `src/app/[locale]/dashboard/menu/` | Availability toggles and prices |
| Tables Management | ✅ | `src/app/[locale]/dashboard/tables/` | QR code generation and status |
| Promotions & Coupons | ✅ | `src/app/[locale]/dashboard/promotions/` | Dynamic discount control |
| Audit Log Viewer | ✅ | `src/app/[locale]/dashboard/audit/` | Full activity visibility |

## 5. Customer Features
| الميزة | Status | الملف | ملاحظة |
|--------|--------|-------|--------|
| Menu Search/Filter | ✅ | `src/components/menu/` | Client-side search + Category snap |
| Cart System | ✅ | `src/lib/cart.ts` | Persistent cart with modifiers |
| Checkout Flow | ✅ | `src/components/checkout/` | Dynamic branch/type selection |
| Order Tracking | ✅ | `src/app/[locale]/order/[id]/` | Real-time status + map (GPS) |
| QR Ordering | ✅ | `src/app/[locale]/table/` | Table-specific flow |
| Customer Loyalty | ✅ | `src/app/[locale]/account/` | Points balance and tiers |
| i18n Toggle | ✅ | `src/components/layout/` | Seamless AR/EN switching |

## 6. Integrations
| Integration | Status | ملاحظة |
|-------------|--------|--------|
| WhatsApp (wa.me) | ✅ | Used for manual order submission |
| Tap Payments | ✅ | Live API integration with webhooks |
| Benefit Pay | 🟡 | Static QR displayed; API blocked on approval |
| Resend (Email) | ✅ | Transactional emails for staff/orders |
| Google Analytics 4 | ✅ | G-521712793 |
| Microsoft Clarity | ✅ | vzlrozut31 |
| Sentry | ✅ | Error tracking active |
| Deliverect | ❌ | Locked Phase 7B |

## 7. PWA / Mobile Apps
| الميزة | Status | ملاحظة |
|--------|--------|--------|
| App Manifest | ✅ | `public/manifest.json` |
| Driver PWA | ✅ | `src/app/[locale]/driver/` |
| Waiter PWA | ✅ | `src/app/[locale]/waiter/` |
| QR Table App | ✅ | `src/app/[locale]/table/` |

## 8. i18n Coverage
| Namespace | AR Keys | EN Keys | المتطابق؟ |
|-----------|---------|---------|-----------|
| UI / Content | 118 KB | 93 KB | ✅ نعم |

## 9. SEO
| الميزة | Status | ملاحظة |
|--------|--------|--------|
| Sitemap | ✅ | `src/app/sitemap.ts` |
| Robots.txt | ✅ | `src/app/robots.ts` |
| Metadata API | ✅ | Canonical links and alternate tags |
| JSON-LD Schema | ✅ | LocalBusiness, MenuItem, FAQ |

## 10. Monitoring
| الأداة | Status | ملاحظة |
|--------|--------|--------|
| Sentry | ✅ | Production tracking |
| Vercel Speed Insights| ✅ | Core Web Vitals tracking |
| GA4 | ✅ | Active |
| Clarity | ✅ | Active |

## ملخص تنفيذي
### ما هو مكتمل فعلاً (✅)
- نظام الطلبات الكامل (Customer, Waiter, QR) مع دعم للأصناف المتغيرة (Variants/Sizes/Modifiers).
- نظام إدارة المطبخ (KDS) الموزع على المحطات (Stations) مع دعم Real-time.
- لوحة تحكم إدارية شاملة تغطي الموظفين، المخزون، التحليلات، والتقارير.
- تكامل الدفع عبر بوابة Tap مع تفعيل الـ Webhooks للتحديث التلقائي.
- تطبيق PWA خاص للسائقين والنادل لسهولة الاستخدام على الهواتف.

### ما هو جزئي ويحتاج إكمال (🟡)
- الدفع عبر Benefit Pay: يعتمد حالياً على QR ثابت وبانتظار الموافقة البنكية للربط البرمجي الكامل.
- إشعارات WhatsApp Business API: بانتظار توثيق Meta للربط المباشر (يتم حالياً عبر wa.me).

### ما هو غائب كلياً (❌)
- الربط مع منصات التوصيل الخارجية (Deliverect): مجدول للمراحل القادمة.
- الميزات القائمة على الذكاء الاصطناعي (AI Analytics): مجدولة للمرحلة 8.

### مشاكل مكتشفة (⚠️)
- لا يوجد مشاكل تقنية حرجة مكتشفة حالياً في استعراض الكود، جميع الـ Stubs تم استبدالها بمنطق حقيقي.
- ملاحظة: بعض الصور في المنيو قد لا تزال مفقودة (خارج نطاق الكود).
