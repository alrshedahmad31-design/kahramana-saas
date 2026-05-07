-- Drop orphaned test table created outside of migrations (had RLS disabled)
DROP TABLE IF EXISTS public.jetski_test;
