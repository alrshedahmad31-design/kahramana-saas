-- 180_seed_turkish_coffee.sql
--
-- Seeds the Turkish Coffee item under the heritage tea & coffee category
-- alongside the existing drinks-iraqi-tea, drinks-black-lemon-tea, and
-- drinks-karak-tea rows. Adds a single row using the slug 'turkish-coffee'
-- (per product request) — note this departs from the 'drinks-*' prefix used
-- by sibling rows in the same category; we honor the supplied slug.
--
-- Station is set explicitly to 'mains' to match every other row in
-- 'the-heritage-tea-and-coffee' (the column default is 'main' but existing
-- drinks rows all carry 'mains'; we stay consistent with the category).
--
-- Image asset /assets/gallery/turkish-coffee.webp is not yet on disk —
-- this row will render the standard missing-image placeholder until the
-- photo is shot and committed. Operator-side asset task; no code blocker.
--
-- Idempotent via ON CONFLICT (id) DO NOTHING — safe to re-run.

INSERT INTO menu_items (
  id, name_ar, name_en, description_ar, description_en,
  price_bhd, category, image_url, is_available, station
) VALUES
  (
    'turkish-coffee',
    'قهوة تركية',
    'Turkish Coffee',
    'قهوة تركية أصيلة تُحضَّر على النار بالطريقة التقليدية، بمذاق غني وعميق ورغوة مخملية ناعمة.',
    'Authentic Turkish coffee slow-brewed over flame the traditional way, with a bold, rich flavor and a silky velvety foam.',
    1.600,
    'the-heritage-tea-and-coffee',
    '/assets/gallery/turkish-coffee.webp',
    true,
    'mains'
  )
ON CONFLICT (id) DO NOTHING;
