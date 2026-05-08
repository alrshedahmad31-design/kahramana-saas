#!/usr/bin/env tsx
/**
 * Seed script: populate menu_items_sync from src/data/menu.json
 *
 * Usage:
 *   npm run seed:menu          # write to DB
 *   npm run seed:menu:dry      # dry-run (no writes)
 *
 * Station mapping mirrors supabase/migrations/078_fix_kds_station_mapping.sql exactly.
 * Table columns: slug, name_ar, name_en, price_bhd, station, last_synced_at, sync_source
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// ─── Types ────────────────────────────────────────────────────────────────────

type KdsStation =
  | 'main'
  | 'grill'
  | 'shawarma'
  | 'bakery'
  | 'appetizer_drinks'

interface MenuItemRaw {
  id: string
  name: { ar: string; en: string }
  price_bhd?: number | null
  sizes?: Record<string, number>
  variants?: Array<{ label: { ar: string; en: string }; price_bhd?: number }>
  available?: boolean
}

interface MenuCategory {
  category: { ar: string; en: string }
  items: MenuItemRaw[]
}

interface SyncRow {
  slug: string
  name_ar: string
  name_en: string
  price_bhd: number | null
  station: KdsStation
  last_synced_at: string
  sync_source: string
}

// ─── Station mapping (mirrors migration 078 exactly) ──────────────────────────

const SLUG_TO_STATION: Record<string, KdsStation> = {
  // ── Grills (mختارات كهرمانة للتوقيع) ──────────────────────────────────────
  'grills-kahramana-mix': 'grill',
  'grills-ribs': 'grill',
  'grills-meat-kabab': 'grill',
  'grills-tikka-meat': 'grill',
  'grills-grilled-neck': 'grill',
  'grills-chicken-kabab': 'grill',
  'grills-chicken-tikka': 'grill',
  'grills-liver': 'grill',
  'grills-chicken-wings': 'grill',
  'grills-arayes': 'grill',
  'grills-mix-grill': 'grill',
  'grills-meat-grills': 'grill',
  'grills-chicken-grills': 'grill',
  'grills-grilled-chicken': 'grill',

  // ── Mains (روائع المائدة البغدادية) ───────────────────────────────────────
  'mains-masgouf': 'main',
  'mains-quzi-iraqi-lamb': 'main',
  'main-kharof': 'main',
  'mains-dlemiya': 'main',
  'mains-dolma': 'main',
  'mains-lamb-neck-rice': 'main',
  'mains-quzi-iraqi-chicken': 'main',
  'mains-meat-thareed': 'main',
  'mains-biryani-meat': 'main',
  'mains-machbous-lamb': 'main',
  'mains-bahraini-quzi-lamb': 'main',
  'mains-meat-mandi': 'main',
  'mains-iraqi-shawarma-rice': 'main',
  'mains-kabab-rice': 'main',
  'mains-stuffed-onion': 'main',
  'mains-stuffed-zucchini': 'main',
  'main-safi-fish-rice': 'main',
  'mains-biryani-chicken': 'main',
  'mains-machbous-chicken': 'main',
  'mains-chicken-mandi': 'main',
  'mains-bahraini-quzi-chicken': 'main',
  'main-rotisserie-chicken': 'main',
  'mains-grilled-chicken-rice': 'main',
  'mains-iraqi-shawarma-thareed': 'main',
  'mains-rice': 'main',

  // ── Cold Appetizers (بستان المقبلات الباردة) ──────────────────────────────
  'cold-apps-mix-appetizer': 'appetizer_drinks',
  'cold-apps-mtabal': 'appetizer_drinks',
  'cold-apps-hummus': 'appetizer_drinks',
  'cold-apps-hummus-meat': 'appetizer_drinks',
  'cold-apps-hummus-shawarma': 'appetizer_drinks',
  'cold-apps-pepper-hummus': 'appetizer_drinks',
  'cold-apps-vine-leaves': 'appetizer_drinks',
  'cold-apps-turshi': 'appetizer_drinks',

  // ── Hot Appetizers (بستان المقبلات الساخنة) ───────────────────────────────
  'hot-apps-dolma': 'appetizer_drinks',
  'hot-apps-mosul-kubba': 'appetizer_drinks',
  'hot-apps-halab-kubba': 'appetizer_drinks',
  'hot-apps-burek-cheese': 'appetizer_drinks',
  'hot-apps-oroug': 'appetizer_drinks',
  'hot-apps-hareesa': 'appetizer_drinks',
  'hot-apps-madhroobah': 'appetizer_drinks',
  'hot-apps-french-fries': 'appetizer_drinks',

  // ── Salads (سلطات نضارة البساتين) ─────────────────────────────────────────
  'salad-tabbouleh': 'appetizer_drinks',
  'salad-fattoush': 'appetizer_drinks',
  'salad-eggplant': 'appetizer_drinks',
  'salad-rocca': 'appetizer_drinks',
  'salad-jajeek': 'appetizer_drinks',
  'salad-green': 'appetizer_drinks',

  // ── Soups (شوربات دافئة) ───────────────────────────────────────────────────
  'soup-sour-kubba': 'appetizer_drinks',
  'soup-lentil': 'appetizer_drinks',
  'soup-mushroom': 'appetizer_drinks',
  'soup-red': 'appetizer_drinks',

  // ── Stews (بيت المرق الأصيل) → main ──────────────────────────────────────
  'stews-bamih': 'main',
  'stews-white-beans': 'main',
  'stews-tabsi': 'main',

  // ── Fatteh (مجموعة الفتات الفاخرة) → main ────────────────────────────────
  'breakfast-fattat-vine-leaves': 'main',
  'breakfast-fattat-eggplant-chickpeas': 'main',
  'breakfast-fattat-falafel': 'main',

  // ── Pastry / Tandoor (مختارات التنور البغدادية) ───────────────────────────
  'pastry-lahm-bi-ajeen': 'bakery',
  'pastry-meat-pie': 'bakery',
  'pastry-meat-shawarma-cheese': 'bakery',
  'pastry-meat-kabab-cheese': 'bakery',
  'pastry-akkawi': 'bakery',
  'pastry-zaatar-plain': 'bakery',
  'pastry-iraqi-bread-dozen': 'bakery',
  'pastry-fatayer-dozen': 'bakery',
  'pastry-labnah': 'bakery',
  'pastry-labnah-cheese': 'bakery',
  'pastry-spinach-labnah': 'bakery',
  'pastry-honey-labnah': 'bakery',
  'pastry-zaatar-labnah': 'bakery',
  'pastry-sausage-labnah': 'bakery',
  'pastry-sausage-cheese-labnah': 'bakery',
  'pastry-meat-shawarma-labnah': 'bakery',
  'pastry-chicken-shawarma-labnah': 'bakery',
  'pastry-falafel-labnah': 'bakery',
  'pastry-spring-pie': 'bakery',
  'pastry-cheese': 'bakery',
  'pastry-zaatar-cheese': 'bakery',
  'pastry-sausage-cheese': 'bakery',
  'pastry-chicken-shawarma-cheese': 'bakery',
  'pastry-meat-spinach': 'bakery',
  'pastry-chicken-spinach': 'bakery',

  // ── Shawarma Suite (أجنحة الشاورما العراقية) ──────────────────────────────
  'shawarma-iraqi-meat-plate': 'shawarma',
  'shawarma-iraqi-meat': 'shawarma',
  'shawarma-iraqi-chicken': 'shawarma',
  'shawarma-arabic-mix': 'shawarma',
  'shawarma-arabic-meat': 'shawarma',
  'shawarma-arabic-chicken': 'shawarma',
  'shawarma-samoon-meat': 'shawarma',
  'shawarma-lebnani-meat': 'shawarma',
  'shawarma-lebnani-chicken': 'shawarma',
  'shawarma-saj-meat': 'shawarma',
  'shawarma-chapati-meat': 'shawarma',
  'shawarma-chapati-chicken': 'shawarma',

  // ── Pizza (بيتزا الفرن الحجري) ────────────────────────────────────────────
  'pizza-kahramana-signature': 'bakery',
  'pizza-shawarma': 'bakery',
  'pizza-kabab': 'bakery',
  'pizza-pepperonata': 'bakery',
  'pizza-margarita': 'bakery',
  'pizza-vegetarian': 'bakery',
  'pizza-pollo': 'bakery',
  'pizza-spinach': 'bakery',
  'pizza-jalapeno-chicken': 'bakery',

  // ── Sandwiches (سندويشات بغدادية) ────────────────────────────────────────
  'sandwiches-meat-kabab': 'bakery',
  'sandwiches-meat-tikka': 'bakery',
  'sandwiches-chicken-kabab': 'bakery',
  'sandwiches-chicken-tikka': 'bakery',
  'sandwiches-grilled-liver': 'bakery',
  'sandwiches-kubba': 'bakery',
  'sandwiches-falafel': 'bakery',
  'sandwiches-beef-liver': 'bakery',
  'sandwiches-chicken-liver': 'bakery',
  'sandwiches-makhlama': 'bakery',
  'sandwiches-shakshouka': 'bakery',
  'sandwiches-special-shakshouka': 'bakery',
  'sandwiches-tomato-special': 'bakery',

  // ── Breakfast (الفطور البغدادي التراثي) → bakery ─────────────────────────
  'breakfast-plates-bagella-bil-dihen': 'bakery',
  'breakfast-tawat-makhlama': 'bakery',
  'breakfast-eggs-fried-eggs': 'bakery',
  'breakfast-eggs-shakshouka-special': 'bakery',
  'breakfast-eggs-meat': 'bakery',
  'breakfast-eggs-basterma': 'bakery',
  'breakfast-tawat-tomato-tawah': 'bakery',
  'breakfast-tawat-chicken-liver': 'bakery',
  'breakfast-tawat-beef-liver': 'bakery',
  'breakfast-plates-halloumi': 'bakery',
  'breakfast-plates-falafel': 'bakery',
  'breakfast-plates-dibis-rashi': 'bakery',
  'breakfast-plates-lablabeh': 'bakery',
  'breakfast-plates-msabaha': 'bakery',
  'breakfast-plates-foul-mdammas': 'bakery',
  'breakfast-plates-labneh': 'bakery',
  'breakfast-plates-debis-dehin': 'bakery',
  'breakfast-plates-bagella': 'bakery',
  'breakfast-eggs-tomatoes': 'bakery',
  'breakfast-eggs-shakshouka': 'bakery',
  'breakfast-eggs-potato': 'bakery',
  'breakfast-eggs-cheese': 'bakery',
  'breakfast-eggs-zaatar': 'bakery',

  // ── Desserts (ختامها مسك) → main ─────────────────────────────────────────
  'desserts-umm-ali': 'main',
  'desserts-fruit-salad': 'main',

  // ── Drinks & Juices (عصائر + شاي) ────────────────────────────────────────
  'drinks-avocado': 'appetizer_drinks',
  'drinks-kahramana-cocktail': 'appetizer_drinks',
  'drinks-strawberry': 'appetizer_drinks',
  'drinks-orange': 'appetizer_drinks',
  'drinks-lemon-mint': 'appetizer_drinks',
  'drinks-pomegranate': 'appetizer_drinks',
  'drinks-mango': 'appetizer_drinks',
  'drinks-laban-mint': 'appetizer_drinks',
  'drinks-soft-drinks': 'appetizer_drinks',
  'drinks-water': 'appetizer_drinks',
  'drinks-iraqi-tea': 'appetizer_drinks',
  'drinks-karak-tea': 'appetizer_drinks',
  'drinks-black-lemon-tea': 'appetizer_drinks',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractPrice(item: MenuItemRaw): number | null {
  if (typeof item.price_bhd === 'number') return item.price_bhd

  if (item.variants && item.variants.length > 0) {
    const prices = item.variants
      .map((v) => v.price_bhd)
      .filter((p): p is number => typeof p === 'number')
    if (prices.length > 0) return Math.min(...prices)
  }

  if (item.sizes) {
    const prices = Object.values(item.sizes).filter(
      (p): p is number => typeof p === 'number',
    )
    if (prices.length > 0) return Math.min(...prices)
  }

  return null
}

function getStation(slug: string): KdsStation {
  return SLUG_TO_STATION[slug] ?? 'main'
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run')

  const menuPath = path.resolve(process.cwd(), 'src/data/menu.json')
  const rawMenu: MenuCategory[] = JSON.parse(fs.readFileSync(menuPath, 'utf8'))

  const now = new Date().toISOString()
  const rows: SyncRow[] = []

  for (const category of rawMenu) {
    for (const item of category.items) {
      const slug = item.id
      const station = getStation(slug)
      const price_bhd = extractPrice(item)

      rows.push({
        slug,
        name_ar: item.name.ar,
        name_en: item.name.en,
        price_bhd,
        station,
        last_synced_at: now,
        sync_source: 'menu.json',
      })
    }
  }

  // ── Station distribution report ──────────────────────────────────────────
  const dist: Record<string, number> = {}
  for (const row of rows) {
    dist[row.station] = (dist[row.station] ?? 0) + 1
  }

  console.log('\n─── menu_items_sync seed ────────────────────────────────')
  console.log(`Mode       : ${isDryRun ? 'DRY RUN (no writes)' : 'LIVE'}`)
  console.log(`Total items: ${rows.length}`)
  console.log('\nStation distribution:')
  for (const [station, count] of Object.entries(dist).sort()) {
    console.log(`  ${station.padEnd(20)} ${count}`)
  }

  const unmapped = rows.filter((r) => !(r.slug in SLUG_TO_STATION))
  if (unmapped.length > 0) {
    console.log(`\n⚠  ${unmapped.length} slug(s) not in SLUG_TO_STATION (defaulted to 'main'):`)
    for (const r of unmapped) console.log(`   - ${r.slug}`)
  } else {
    console.log('\n✓ All slugs have explicit station mappings')
  }

  if (isDryRun) {
    console.log('\n─── DRY RUN complete. No data written. ─────────────────\n')
    console.log('First 5 rows:')
    for (const row of rows.slice(0, 5)) {
      console.log(JSON.stringify(row, null, 2))
    }
    return
  }

  // ── Upsert ───────────────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      '\n✗ Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    )
    console.error('  Ensure .env.local exists with these values.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const BATCH = 50
  let inserted = 0
  let errors = 0

  console.log('\nUpserting in batches of', BATCH, '...')

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase
      .from('menu_items_sync')
      .upsert(batch, { onConflict: 'slug' })

    if (error) {
      console.error(`  ✗ Batch ${Math.floor(i / BATCH) + 1} failed:`, error.message)
      errors += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`  ✓ ${inserted}/${rows.length}\r`)
    }
  }

  console.log(`\n\n─── Seed complete ───────────────────────────────────────`)
  console.log(`  Processed : ${rows.length}`)
  console.log(`  Inserted  : ${inserted}`)
  console.log(`  Errors    : ${errors}`)

  if (errors === 0) {
    console.log('\n✓ All items seeded successfully.')
    console.log('\nVerification queries (run in Supabase SQL Editor):')
    console.log('  SELECT station, COUNT(*) FROM menu_items_sync GROUP BY station ORDER BY station;')
    console.log('  SELECT COUNT(*) FROM menu_items_sync WHERE station IS NULL;')
  } else {
    console.error('\n✗ Some batches failed. Check errors above.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
