-- =============================================================================
-- SP DENT — KOMPLETAN RESET BAZE ZA NOVI POČETAK (ČISTA BAZA)
-- Pokretanjem ovog koda baza se potpuno prazni od svih test podataka,
-- a tabele, šeme i indeksi ostaju 100% spremni za uvoz 6.675 pacijenata.
-- =============================================================================

-- 1. Prazni sve povezane tabele (kartoni, izveštaji, termini, pacijenti)
TRUNCATE TABLE 
  public.tooth_treatments,
  public.clinical_reports,
  public.appointments,
  public.patients 
CASCADE;

-- 2. Postavlja/proverava UNIQUE indeks na broj kartona (da nema dupliranja)
DROP INDEX IF EXISTS patients_chart_number_unique_idx;
CREATE UNIQUE INDEX patients_chart_number_unique_idx
  ON public.patients (LOWER(TRIM(chart_number)))
  WHERE chart_number IS NOT NULL AND TRIM(chart_number) <> '';

DROP INDEX IF EXISTS patients_chart_number_idx;
CREATE INDEX IF NOT EXISTS patients_chart_number_idx
  ON public.patients(chart_number) WHERE chart_number IS NOT NULL;
