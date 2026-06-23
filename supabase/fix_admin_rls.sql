-- =============================================================================
-- SP DENT — FIX: Dodaj admin korisnika i proveri RLS
-- Pokreni ovo u Supabase SQL Editor (https://xmebxxumufngthtkctub.supabase.co)
-- Dashboard → SQL Editor → New query → Zalepi i Run
-- =============================================================================

-- 1. Proveri da li tabela admin_users postoji i da li je tvoj user u njoj
SELECT 'admin_users check' AS step, * FROM public.admin_users;

-- 2. Ako nema tvog usera, dodaj ga (tvoj UID)
INSERT INTO public.admin_users (user_id, name, role) VALUES
  ('98bd40ba-900f-41f4-99fe-7c70ec2690ed', 'Admin', 'doctor')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Proveri ponovo
SELECT 'after insert' AS step, * FROM public.admin_users;

-- 4. Proveri da li is_admin() funkcionise za tvog usera
-- (ovo ce vratiti false jer SQL Editor koristi service role, ali tabela treba da postoji)
SELECT is_admin() AS is_admin_result;

-- 5. Proveri RLS politike na patients tabeli
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'patients';

-- 6. Proveri da li tabela patients postoji i ima li kolone
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'patients'
ORDER BY ordinal_position;
