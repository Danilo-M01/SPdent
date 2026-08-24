-- =============================================================================
-- SP DENT — ADD chart_number COLUMN TO patients TABLE
-- Pokrenite ovu skriptu u Supabase SQL Editoru
-- =============================================================================

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS chart_number TEXT;

-- Opcioni indeks za brzu pretragu po broju kartona
CREATE INDEX IF NOT EXISTS patients_chart_number_idx
  ON public.patients(chart_number)
  WHERE chart_number IS NOT NULL;
