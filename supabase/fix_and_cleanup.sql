-- =============================================================================
-- SP DENT — KOMPLETAN CLEANUP & ZAŠTITA BAZE (SVE U JEDNOM)
-- Pokrenite ceo ovaj fajl u Supabase SQL Editoru klikom na RUN.
-- =============================================================================

-- 1. BRISANJE TEST/DEMO PODATAKA (UUID pattern: aaaaaaaa-...)
DELETE FROM public.patients WHERE id::text LIKE 'aaaaaaaa-%';

-- 2. PRENOS TERMINA SA DUPLIKATA NA GLAVNOG (NAJSTARIJEG) PACIJENTA
--    Ovim se osigurava da nijedan zakazani termin ne bude obrisan.
WITH kept_patients AS (
  SELECT DISTINCT ON (LOWER(TRIM(first_name)), COALESCE(LOWER(TRIM(last_name)), ''))
    id, first_name, last_name
  FROM public.patients
  WHERE phone LIKE '/-no-phone-%'
  ORDER BY LOWER(TRIM(first_name)), COALESCE(LOWER(TRIM(last_name)), ''), created_at ASC
),
duplicate_patients AS (
  SELECT p.id AS dup_id, k.id AS keep_id
  FROM public.patients p
  JOIN kept_patients k
    ON LOWER(TRIM(p.first_name)) = LOWER(TRIM(k.first_name))
   AND COALESCE(LOWER(TRIM(p.last_name)), '') = COALESCE(LOWER(TRIM(k.last_name)), '')
  WHERE p.phone LIKE '/-no-phone-%'
    AND p.id <> k.id
)
UPDATE public.appointments a
SET patient_id = d.keep_id
FROM duplicate_patients d
WHERE a.patient_id = d.dup_id;

-- 3. BRISANJE DUPLIKATA pacijenata bez telefona sa istim imenom
--    Čuva najstarijeg (originalnog) pacijenta, a briše nagomilane duplikate iz ranijih uvoza.
DELETE FROM public.patients
WHERE id IN (
  SELECT p.id FROM public.patients p
  WHERE p.phone LIKE '/-no-phone-%'
    AND EXISTS (
      SELECT 1 FROM public.patients p2
      WHERE p2.phone LIKE '/-no-phone-%'
        AND LOWER(TRIM(p2.first_name)) = LOWER(TRIM(p.first_name))
        AND COALESCE(LOWER(TRIM(p2.last_name)), '') = COALESCE(LOWER(TRIM(p.last_name)), '')
        AND p2.id <> p.id
        AND p2.created_at < p.created_at
    )
);

-- 4. BRISANJE DUPLIKATA pacijenata sa istim brojem kartona (ako ih ima)
DELETE FROM public.patients
WHERE id IN (
  SELECT p.id FROM public.patients p
  WHERE p.chart_number IS NOT NULL AND p.chart_number <> ''
    AND EXISTS (
      SELECT 1 FROM public.patients p2
      WHERE LOWER(TRIM(p2.chart_number)) = LOWER(TRIM(p.chart_number))
        AND p2.id <> p.id AND p2.created_at < p.created_at
    )
);

-- 5. UNIQUE ZAŠTITNI INDEKS: Baza od sada na nivou sistema sprečava unos istog kartona
DROP INDEX IF EXISTS patients_chart_number_unique_idx;
CREATE UNIQUE INDEX patients_chart_number_unique_idx
  ON public.patients (LOWER(TRIM(chart_number)))
  WHERE chart_number IS NOT NULL AND TRIM(chart_number) <> '';

DROP INDEX IF EXISTS patients_chart_number_idx;
CREATE INDEX IF NOT EXISTS patients_chart_number_idx
  ON public.patients(chart_number) WHERE chart_number IS NOT NULL;
