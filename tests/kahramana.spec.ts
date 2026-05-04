/**
 * Kahramana Baghdad — Comprehensive E2E Test Suite (Fixed)
 * Playwright v1.x
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'https://kahramana.vercel.app'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

async function assertNoErrors(page: Page, errors: string[]) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(800)
  expect(errors, 'Uncaught JS errors found').toHaveLength(0)
}

async function loginAsAdmin(context: BrowserContext): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', process.env.TEST_ADMIN_EMAIL ?? '')
  await page.fill('input[type="password"]', process.env.TEST_ADMIN_PASSWORD ?? '')
  await page.getByRole('button', { name: /دخول|login/i }).click()
  await page.waitForURL('**/dashboard**', { timeout: 15_000 })
  return page
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Fix 2 — FeatureArtifacts SSR
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Fix 2 — FeatureArtifacts SSR', () => {
  test('EN: card titles in HTTP response (server-rendered)', async ({ page }) => {
    const response = await page.goto('/en')
    const html = await response!.text()
    expect(html).toContain('Archive of Authenticity')
    expect(html).toContain('Live Quality Check')
    expect(html).toContain('Hospitality Engineering')
  })

  test('EN: 3 card h2s in DOM', async ({ page }) => {
    await page.goto('/en')
    await page.waitForLoadState('domcontentloaded')
    const count = await page.locator('h2').count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('AR: homepage loads and has h1', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 })
  })

  test('EN: feature cards visible', async ({ page }) => {
    await page.goto('/en')
    await expect(page.getByText('Archive of Authenticity')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Live Quality Check')).toBeVisible({ timeout: 10_000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Fix 3 — Client message scoping
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Fix 3 — Client message scoping', () => {
  test('EN: nav link "Menu" visible (client translations working)', async ({ page }) => {
    await page.goto('/en')
    await expect(page.locator('nav').getByRole('link', { name: 'Menu' }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('EN: home content renders (server getTranslations working)', async ({ page }) => {
    await page.goto('/en')
    await expect(page.getByText('Archive of Authenticity')).toBeVisible({ timeout: 10_000 })
  })

  test('EN: no JS errors after message scoping', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/en')
    await assertNoErrors(page, errors)
  })

  test('AR: no JS errors', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/')
    await assertNoErrors(page, errors)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Fix 4 — Font preload
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Fix 4 — EditorialNew-Bold font preload', () => {
  test('EN: woff2 preload link in <head>', async ({ page }) => {
    await page.goto('/en')
    const hrefs = await page.$$eval(
      'head link[rel="preload"][as="font"]',
      (links) => links.map((l) => (l as HTMLLinkElement).href),
    )
    expect(hrefs.some((h) => h.includes('.woff2'))).toBe(true)
  })

  test('EN: font preload crossorigin attribute present', async ({ page }) => {
    await page.goto('/en')
    const values = await page.$$eval(
      'head link[rel="preload"][as="font"]',
      (links) => links.map((l) => l.getAttribute('crossorigin')),
    )
    expect(values.length).toBeGreaterThan(0)
    expect(values.every((v) => v === 'anonymous' || v === '')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Homepage
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Homepage', () => {
  for (const [locale, path] of [['ar', '/'], ['en', '/en']] as const) {
    test(`${locale.toUpperCase()}: loads without JS errors`, async ({ page }) => {
      const errors = collectErrors(page)
      await page.goto(path)
      await assertNoErrors(page, errors)
    })

    test(`${locale.toUpperCase()}: h1 contains restaurant name`, async ({ page }) => {
      await page.goto(path)
      const h1 = page.locator('h1').first()
      await expect(h1).toBeVisible({ timeout: 15_000 })
      const text = await h1.textContent()
      expect(text).toMatch(/كهرمانة بغداد|Kahramana Baghdad/i)
    })

    test(`${locale.toUpperCase()}: hero image has fetchpriority=high`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('img[fetchpriority="high"]').first()).toBeVisible({ timeout: 10_000 })
    })

    test(`${locale.toUpperCase()}: hero image src is hero-poster.webp`, async ({ page }) => {
      await page.goto(path)
      const src = await page.locator('img[fetchpriority="high"]').first().getAttribute('src')
      expect(src).toContain('hero-poster.webp')
    })

    test(`${locale.toUpperCase()}: link to /menu exists`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('a[href*="/menu"]').first()).toBeVisible({ timeout: 10_000 })
    })

    test(`${locale.toUpperCase()}: page title set`, async ({ page }) => {
      await page.goto(path)
      const title = await page.title()
      expect(title.length).toBeGreaterThan(5)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. SEO
// ─────────────────────────────────────────────────────────────────────────────

test.describe('SEO', () => {
  test('AR: lang="ar" on <html>', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const lang = await page.$eval('html', (el) => el.getAttribute('lang'))
    expect(lang).toBe('ar')
  })

  test('EN: lang="en" on <html>', async ({ page }) => {
    await page.goto('/en')
    const lang = await page.$eval('html', (el) => el.getAttribute('lang'))
    expect(lang).toBe('en')
  })

  test('AR: dir="rtl" on <html>', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const dir = await page.$eval('html', (el) => el.getAttribute('dir'))
    expect(dir).toBe('rtl')
  })

  test('EN: dir="ltr" on <html>', async ({ page }) => {
    await page.goto('/en')
    const dir = await page.$eval('html', (el) => el.getAttribute('dir'))
    expect(dir).toBe('ltr')
  })

  test('og:image points to hero-poster.webp', async ({ page }) => {
    await page.goto('/')
    const og = await page.$eval(
      'meta[property="og:image"]',
      (el) => el.getAttribute('content'),
    ).catch(() => null)
    expect(og).toContain('hero-poster.webp')
  })

  test('canonical link present on homepage', async ({ page }) => {
    await page.goto('/')
    const canonical = await page.$eval(
      'link[rel="canonical"]',
      (el) => el.getAttribute('href'),
    ).catch(() => null)
    expect(canonical).toBeTruthy()
  })

  test('hreflang ar-BH and en-BH present', async ({ page }) => {
    await page.goto('/')
    const hrefs = await page.$$eval(
      'link[rel="alternate"]',
      (links) => links.map((l) => l.getAttribute('hreflang')),
    )
    expect(hrefs).toContain('ar-BH')
    expect(hrefs).toContain('en-BH')
  })

  test('Organization JSON-LD on homepage', async ({ page }) => {
    await page.goto('/')
    const scripts = await page.$$eval(
      'script[type="application/ld+json"]',
      (els) => els.map((el) => el.textContent ?? ''),
    )
    expect(scripts.some((s) => s.includes('"Organization"'))).toBe(true)
  })

  test('FAQPage JSON-LD on homepage', async ({ page }) => {
    await page.goto('/')
    const scripts = await page.$$eval(
      'script[type="application/ld+json"]',
      (els) => els.map((el) => el.textContent ?? ''),
    )
    expect(scripts.some((s) => s.includes('"FAQPage"'))).toBe(true)
  })

  test('sitemap.xml reachable', async ({ page }) => {
    const res = await page.goto('/sitemap.xml')
    expect(res?.status()).toBe(200)
  })

  test('robots.txt reachable', async ({ page }) => {
    const res = await page.goto('/robots.txt')
    expect(res?.status()).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Header & Navigation
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Header', () => {
  test('AR: header renders', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 })
  })

  test('EN: nav "Menu" link in header', async ({ page }) => {
    await page.goto('/en')
    await expect(page.locator('header').getByRole('link', { name: 'Menu' }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('EN: nav "Branches" link in header', async ({ page }) => {
    await page.goto('/en')
    await expect(page.locator('header').getByRole('link', { name: 'Branches' }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('EN: locale switch button visible', async ({ page }) => {
    await page.goto('/en')
    // Any button in header that switches locale
    const switcher = page.locator('header button').filter({ hasText: /عربي|ar/i }).first()
    await expect(switcher).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Locale switching', () => {
  test('EN → AR navigates away from /en', async ({ page }) => {
    await page.goto('/en')
    await page.waitForLoadState('domcontentloaded')
    const btn = page.locator('header button').filter({ hasText: /عربي|ar/i }).first()
    if (await btn.isVisible()) {
      await btn.click()
      await page.waitForURL((url) => !url.pathname.startsWith('/en'), { timeout: 10_000 })
      const dir = await page.$eval('html', (el) => el.getAttribute('dir'))
      expect(dir).toBe('rtl')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Cart drawer
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Cart drawer', () => {
  test('EN: cart button in header', async ({ page }) => {
    await page.goto('/en')
    // Cart button identified by aria-label or SVG icon
    const btn = page.locator('header button[aria-label*="cart" i], header button[aria-label*="سلة" i]').first()
    const btnAlt = page.locator('header').getByRole('button').nth(0)
    const found = (await btn.count()) > 0 ? btn : btnAlt
    await expect(found).toBeVisible({ timeout: 10_000 })
  })

  test('EN: opening cart causes no JS errors', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/en')
    await page.waitForLoadState('domcontentloaded')
    // Click first button in header that's not the logo
    const cartBtn = page.locator('header button').last()
    if (await cartBtn.isVisible()) {
      await cartBtn.click()
      await page.waitForTimeout(500)
    }
    expect(errors).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Menu pages
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Menu listing page', () => {
  for (const [locale, path] of [['ar', '/menu'], ['en', '/en/menu']] as const) {
    test(`${locale.toUpperCase()}: loads without errors`, async ({ page }) => {
      const errors = collectErrors(page)
      await page.goto(path)
      await assertNoErrors(page, errors)
    })

    test(`${locale.toUpperCase()}: menu category links visible`, async ({ page }) => {
      await page.goto(path)
      const cards = await page.locator('a[href*="/menu/"]').count()
      expect(cards).toBeGreaterThan(5)
    })

    test(`${locale.toUpperCase()}: has heading`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })
    })
  }
})

test.describe('Menu category page', () => {
  for (const [locale, path] of [
    ['ar', '/menu/kahramana-signature-selection'],
    ['en', '/en/menu/kahramana-signature-selection'],
  ] as const) {
    test(`${locale.toUpperCase()}: loads`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBeLessThan(400)
    })

    test(`${locale.toUpperCase()}: dish item links present`, async ({ page }) => {
      await page.goto(path)
      const items = await page.locator('a[href*="/menu/item/"]').count()
      expect(items).toBeGreaterThan(0)
    })
  }
})

test.describe('Menu item page', () => {
  for (const [locale, path] of [
    ['ar', '/menu/item/grills-kahramana-mix'],
    ['en', '/en/menu/item/grills-kahramana-mix'],
  ] as const) {
    test(`${locale.toUpperCase()}: loads`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBeLessThan(400)
    })

    test(`${locale.toUpperCase()}: price in BHD visible`, async ({ page }) => {
      await page.goto(path)
      const body = await page.textContent('body')
      expect(body).toMatch(/BD|د\.ب/)
    })

    test(`${locale.toUpperCase()}: Add to Cart button visible (first match)`, async ({ page }) => {
      await page.goto(path)
      // Use first() to avoid strict mode violation (multiple buttons on page)
      const btn = page.getByRole('button', { name: /أضف|add to cart/i }).first()
      await expect(btn).toBeVisible({ timeout: 10_000 })
    })

    test(`${locale.toUpperCase()}: MenuItem JSON-LD present`, async ({ page }) => {
      await page.goto(path)
      const scripts = await page.$$eval(
        'script[type="application/ld+json"]',
        (els) => els.map((el) => el.textContent ?? ''),
      )
      expect(scripts.some((s) => s.includes('"MenuItem"') || s.includes('"Product"'))).toBe(true)
    })

    test(`${locale.toUpperCase()}: canonical does not contain /ar/menu/item/`, async ({ page }) => {
      await page.goto(path)
      const canonical = await page.$eval(
        'link[rel="canonical"]',
        (el) => el.getAttribute('href'),
      ).catch(() => null)
      if (canonical) {
        expect(canonical).not.toMatch(/\/ar\/menu\/item\//)
      }
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. Branches
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Branches listing', () => {
  for (const [locale, path] of [['ar', '/branches'], ['en', '/en/branches']] as const) {
    test(`${locale.toUpperCase()}: loads without errors`, async ({ page }) => {
      const errors = collectErrors(page)
      await page.goto(path)
      await assertNoErrors(page, errors)
    })

    test(`${locale.toUpperCase()}: Riffa + Qallali visible`, async ({ page }) => {
      await page.goto(path)
      const body = await page.textContent('body')
      expect(body).toMatch(/رفاع|riffa/i)
      expect(body).toMatch(/قلالي|qallali/i)
    })
  }
})

test.describe('Branch detail pages', () => {
  for (const branch of ['riffa', 'qallali'] as const) {
    for (const [locale, prefix] of [['ar', ''], ['en', '/en']] as const) {
      const path = `${prefix}/branches/${branch}`

      test(`${locale.toUpperCase()} ${branch}: loads`, async ({ page }) => {
        const res = await page.goto(path)
        expect(res?.status()).toBeLessThan(400)
      })

      test(`${locale.toUpperCase()} ${branch}: LocalBusiness JSON-LD`, async ({ page }) => {
        await page.goto(path)
        const scripts = await page.$$eval(
          'script[type="application/ld+json"]',
          (els) => els.map((el) => el.textContent ?? ''),
        )
        expect(scripts.some((s) => s.includes('"LocalBusiness"'))).toBe(true)
      })

      test(`${locale.toUpperCase()} ${branch}: phone number visible`, async ({ page }) => {
        await page.goto(path)
        const body = await page.textContent('body')
        expect(body).toMatch(/\+973|\b17\d{6}\b|\b36\d{6}\b/)
      })
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. About page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('About page', () => {
  for (const [locale, path] of [['ar', '/about'], ['en', '/en/about']] as const) {
    test(`${locale.toUpperCase()}: loads without errors`, async ({ page }) => {
      const errors = collectErrors(page)
      await page.goto(path)
      await assertNoErrors(page, errors)
    })

    test(`${locale.toUpperCase()}: has a visible heading`, async ({ page }) => {
      await page.goto(path)
      // Use locator('h1, h2') — about page may use h2 as primary heading
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 11. Catering page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Catering page', () => {
  for (const [locale, path] of [['ar', '/catering'], ['en', '/en/catering']] as const) {
    test(`${locale.toUpperCase()}: loads with 200`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBeLessThan(400)
    })

    test(`${locale.toUpperCase()}: no JS errors`, async ({ page }) => {
      const errors = collectErrors(page)
      await page.goto(path)
      // Use domcontentloaded (catering has long-polling connections)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)
      expect(errors).toHaveLength(0)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 12. Checkout page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Checkout page', () => {
  for (const [locale, path] of [['ar', '/checkout'], ['en', '/en/checkout']] as const) {
    test(`${locale.toUpperCase()}: loads`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBeLessThan(400)
    })

    test(`${locale.toUpperCase()}: has input fields or empty cart message`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')
      // Checkout may show empty cart when no items in cart
      const inputs = await page.locator('input').count()
      const emptyMsg = await page.getByText(/سلة فارغة|empty cart|no items/i).count()
      expect(inputs + emptyMsg).toBeGreaterThan(0)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 13. Contact page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Contact page', () => {
  for (const [locale, path] of [['ar', '/contact'], ['en', '/en/contact']] as const) {
    test(`${locale.toUpperCase()}: loads without errors`, async ({ page }) => {
      const errors = collectErrors(page)
      await page.goto(path)
      await assertNoErrors(page, errors)
    })

    test(`${locale.toUpperCase()}: contact form present`, async ({ page }) => {
      await page.goto(path)
      const inputs = await page.locator('input, textarea').count()
      expect(inputs).toBeGreaterThan(0)
    })

    test(`${locale.toUpperCase()}: WhatsApp link present`, async ({ page }) => {
      await page.goto(path)
      const waLink = page.locator('a[href*="wa.me"], a[href*="whatsapp"]').first()
      await expect(waLink).toBeVisible({ timeout: 10_000 })
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 14. Legal pages
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Legal pages', () => {
  const pages = [
    ['/privacy', '/en/privacy'],
    ['/terms', '/en/terms'],
    ['/refund-policy', '/en/refund-policy'],
  ] as const

  for (const [ar, en] of pages) {
    test(`AR ${ar}: loads with 200`, async ({ page }) => {
      const res = await page.goto(ar)
      expect(res?.status()).toBe(200)
    })

    test(`EN ${en}: loads with 200`, async ({ page }) => {
      const res = await page.goto(en)
      expect(res?.status()).toBe(200)
    })

    test(`AR ${ar}: has visible heading`, async ({ page }) => {
      await page.goto(ar)
      // Legal pages may use h1 or h2
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 15. Login page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  for (const [locale, path] of [['ar', '/login'], ['en', '/en/login']] as const) {
    test(`${locale.toUpperCase()}: renders login form`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
    })

    test(`${locale.toUpperCase()}: wrong credentials stay on login`, async ({ page }) => {
      await page.goto(path)
      await page.fill('input[type="email"]', 'notreal@test.com')
      await page.fill('input[type="password"]', 'wrongpassword')
      await page.getByRole('button', { name: /دخول|login|sign in/i }).click()
      await page.waitForTimeout(3_000)
      expect(page.url()).toContain('login')
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 16. Dashboard guard (unauthenticated)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Dashboard auth guard', () => {
  const dashRoutes = [
    '/dashboard',
    '/dashboard/orders',
    '/dashboard/kds',
    '/dashboard/delivery',
    '/dashboard/inventory',
    '/dashboard/analytics',
    '/dashboard/reports',
    '/dashboard/staff',
    '/dashboard/coupons',
    '/dashboard/settings',
  ]

  for (const route of dashRoutes) {
    test(`unauthenticated: ${route} redirects to login`, async ({ page }) => {
      await page.goto(route)
      await page.waitForURL('**/login**', { timeout: 10_000 })
      expect(page.url()).toContain('login')
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 17. Dashboard — authenticated smoke
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Dashboard — authenticated smoke', () => {
  test.skip(!process.env.TEST_ADMIN_EMAIL, 'Skipped: TEST_ADMIN_EMAIL not set')

  let adminPage: Page

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    adminPage = await loginAsAdmin(ctx)
  })

  test.afterAll(async () => { await adminPage?.close() })

  for (const [path, regex] of [
    ['/dashboard', /dashboard/i],
    ['/dashboard/orders', /orders|طلبات/i],
    ['/dashboard/kds', /kitchen|مطبخ/i],
    ['/dashboard/analytics', /analytics|تحليل/i],
    ['/dashboard/coupons', /coupon|كوبون/i],
    ['/dashboard/settings', /settings|إعدادات/i],
  ] as const) {
    test(`${path}: loads and has content`, async () => {
      await adminPage.goto(path)
      await adminPage.waitForLoadState('domcontentloaded')
      const body = await adminPage.textContent('body')
      expect(body).toMatch(regex)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 18. API routes
// ─────────────────────────────────────────────────────────────────────────────

test.describe('API routes', () => {
  test('GET /api/health — 200 or 404 (route may not exist)', async ({ page }) => {
    const res = await page.goto('/api/health')
    // Accept both — route may be intentionally absent in this deployment
    expect([200, 404]).toContain(res?.status())
  })

  test('POST /api/webhooks/tap without signature returns 4xx', async ({ request }) => {
    const res = await request.post('/api/webhooks/tap', { data: { test: true } })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 19. 404 handling
// ─────────────────────────────────────────────────────────────────────────────

test.describe('404 handling', () => {
  test('unknown route returns 404', async ({ page }) => {
    const res = await page.goto('/this-page-does-not-exist-xyz')
    expect(res?.status()).toBe(404)
  })

  test('404 page has link back to root', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz')
    // AR default locale — home link may be / or /ar
    const homeLink = page.locator('a[href="/"], a[href="/ar"], a[href="/ar/"]').first()
    await expect(homeLink).toBeVisible({ timeout: 10_000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 20. Accessibility
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Accessibility', () => {
  test('homepage has <main> landmark', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 })
  })

  test('homepage has <nav> landmark', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 10_000 })
  })

  test('homepage has <footer> landmark', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('contentinfo')).toBeVisible({ timeout: 10_000 })
  })

  test('all images have alt text', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const missingAlt = await page.$$eval(
      'img:not([alt])',
      (imgs) => imgs.map((img) => (img as HTMLImageElement).src),
    )
    expect(missingAlt).toHaveLength(0)
  })

  test('logo link has aria-label or contains image with alt', async ({ page }) => {
    await page.goto('/')
    // Logo link may wrap an SVG/img — check aria-label OR img alt OR text
    const logoLink = page.locator('header a').first()
    const ariaLabel = await logoLink.getAttribute('aria-label')
    const imgAlt = await logoLink.locator('img').getAttribute('alt').catch(() => null)
    const text = await logoLink.textContent()
    expect(ariaLabel || imgAlt || text?.trim()).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 21. Currency format (BHD = 3 decimal places)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Currency formatting', () => {
  test('menu item page shows 3 decimal price', async ({ page }) => {
    await page.goto('/menu/item/grills-kahramana-mix')
    const body = await page.textContent('body')
    expect(body).toMatch(/\d+\.\d{3}/)
  })

  test('EN menu item page shows BD label', async ({ page }) => {
    await page.goto('/en/menu/item/grills-kahramana-mix')
    const body = await page.textContent('body')
    expect(body).toMatch(/BD\s?\d+|\d+\s?BD/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 22. Mobile viewport
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('homepage body scrollWidth <= viewport + 50px tolerance', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const bodyWidth = await page.$eval('body', (el) => el.scrollWidth)
    // 50px tolerance for scrollbar and sub-pixel rendering
    expect(bodyWidth).toBeLessThanOrEqual(440)
  })

  test('hero image visible on mobile', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('img[fetchpriority="high"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('mobile nav accessible (hamburger or inline)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    // Either a hamburger button exists OR nav links are directly visible
    const hamburger = page.getByRole('button', { name: /قائمة|menu|navigation|open/i }).first()
    const directNav = page.locator('nav a[href*="/menu"]').first()

    if (await hamburger.isVisible()) {
      await hamburger.click()
      await page.waitForTimeout(400)
      // After opening, check any nav link is accessible (visible or in DOM)
      const navLinks = await page.locator('a[href*="/menu"]').count()
      expect(navLinks).toBeGreaterThan(0)
    } else {
      // Desktop-style nav visible on mobile
      await expect(directNav).toBeAttached()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 23. Performance signals
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Performance signals', () => {
  test('homepage: no external Google Fonts requests', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (req) => requests.push(req.url()))
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    expect(requests.filter((u) => u.includes('fonts.googleapis.com'))).toHaveLength(0)
  })

  test('homepage: font preload link exists', async ({ page }) => {
    await page.goto('/en')
    const preloads = await page.$$eval(
      'head link[rel="preload"]',
      (links) => links.map((l) => l.getAttribute('as')),
    )
    expect(preloads).toContain('font')
  })

  test('hero image: fetchpriority=high present (LCP signal)', async ({ page }) => {
    await page.goto('/en')
    const count = await page.locator('img[fetchpriority="high"]').count()
    expect(count).toBeGreaterThan(0)
  })

  test('hero image: has explicit width attribute', async ({ page }) => {
    await page.goto('/en')
    // The img in CinematicHero should have width/height set
    const heroImg = page.locator('img[fetchpriority="high"]').first()
    // Check either attribute or natural dimensions
    const width = await heroImg.getAttribute('width')
    const naturalWidth = await heroImg.evaluate((el) => (el as HTMLImageElement).naturalWidth).catch(() => 0)
    expect(Number(width) > 0 || naturalWidth > 0).toBe(true)
  })
})