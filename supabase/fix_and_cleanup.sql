-- =============================================================================
-- SP DENT — FIX & CLEANUP SCRIPT v1.1 (FIXED)
-- 1. Brise sve test/demo podatke (aaaaaaaa-... UUID-ovi)
-- 2. Brise duplikate pacijenata (isti chart_number ili isti ime bez telefona)
-- 3. Dodaje UNIQUE index na chart_number
-- 4. Kreira upsert_patient_by_chart RPC funkciju za pouzdan import
-- Pokrenite u Supabase SQL Editoru
-- =============================================================================

-- 1. BRISANJE TEST/DEMO PODATAKA (UUID pattern: aaaaaaaa-...)
DELETE FROM public.patients WHERE id::text LIKE 'aaaaaaaa-%';

-- 2. BRISANJE DUPLIKATA pacijenata bez telefona sa istim imenom
-- Cuva NAJSTARIJI zapis, brise novije
DELETE FROM public.patients
WHERE id IN (
  SELECT p.id FROM public.patients p
  WHERE p.phone LIKE '/-no-phone-%'
    AND EXISTS (
      SELECT 1 FROM public.patients p2
      WHERE p2.phone LIKE '/-no-phone-%'
        AND p2.first_name = p.first_name
        AND (p2.last_name = p.last_name OR (p2.last_name IS NULL AND p.last_name IS NULL))
        AND p2.id <> p.id
        AND p2.created_at < p.created_at
    )
);

-- 3. BRISANJE DUPLIKATA pacijenata sa istim chart_number
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

-- 4. UNIQUE INDEX NA chart_number (case-insensitive)
DROP INDEX IF EXISTS patients_chart_number_unique_idx;
CREATE UNIQUE INDEX patients_chart_number_unique_idx
  ON public.patients (LOWER(TRIM(chart_number)))
  WHERE chart_number IS NOT NULL AND TRIM(chart_number) <> '';

DROP INDEX IF EXISTS patients_chart_number_idx;
CREATE INDEX IF NOT EXISTS patients_chart_number_idx
  ON public.patients(chart_number) WHERE chart_number IS NOT NULL;

-- 5. RPC FUNKCIJA za pouzdan import bez duplikata
-- VAZNO: $$ su obavezni delimiteri za PL/pgSQL telo funkcije!
CREATE OR REPLACE FUNCTION public.upsert_patient_by_chart(
  p_first_name     TEXT,
  p_last_name      TEXT,
  p_phone          TEXT,
  p_email          TEXT,
  p_parent_name    TEXT,
  p_medical_alerts TEXT,
  p_notes          TEXT,
  p_category       TEXT,
  p_chart_number   TEXT
)
RETURNS TABLE(id UUID, action TEXT)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_existing_id    UUID;
  v_existing_phone TEXT;
BEGIN
  -- Pokusaj da nadje postojeceg pacijenta po chart_number
  SELECT patients.id, patients.phone
    INTO v_existing_id, v_existing_phone
    FROM public.patients
   WHERE LOWER(TRIM(patients.chart_number)) = LOWER(TRIM(p_chart_number))
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Azuriraj postojeceg pacijenta (samo prazna polja se prepisuju)
    UPDATE public.patients SET
      first_name     = COALESCE(NULLIF(TRIM(p_first_name), ''), patients.first_name),
      last_name      = COALESCE(NULLIF(TRIM(COALESCE(p_last_name, '')), ''), patients.last_name),
      phone          = CASE
                         WHEN p_phone IS NOT NULL
                          AND p_phone NOT LIKE '/-no-phone-%'
                          AND p_phone <> '/'
                         THEN p_phone
                         ELSE patients.phone
                       END,
      email          = COALESCE(NULLIF(TRIM(COALESCE(p_email, '')), ''), patients.email),
      parent_name    = COALESCE(NULLIF(TRIM(COALESCE(p_parent_name, '')), ''), patients.parent_name),
      medical_alerts = COALESCE(NULLIF(TRIM(COALESCE(p_medical_alerts, '')), ''), patients.medical_alerts),
      notes          = CASE
                         WHEN p_notes IS NOT NULL AND TRIM(p_notes) <> '' THEN
                           CASE
                             WHEN patients.notes IS NOT NULL
                              AND patients.notes NOT LIKE '%' || TRIM(p_notes) || '%'
                             THEN TRIM(p_notes) || ' | ' || patients.notes
                             ELSE COALESCE(patients.notes, TRIM(p_notes))
                           END
                         ELSE patients.notes
                       END,
      category       = CASE
                         WHEN p_category IS NOT NULL AND p_category <> 'regular'
                         THEN p_category
                         ELSE patients.category
                       END,
      updated_at     = NOW()
    WHERE patients.id = v_existing_id;

    RETURN QUERY SELECT v_existing_id, 'updated'::TEXT;

  ELSE
    -- Unesi novog pacijenta
    INSERT INTO public.patients (
      first_name, last_name, phone, email,
      parent_name, medical_alerts, notes, category, chart_number
    )
    VALUES (
      COALESCE(NULLIF(TRIM(p_first_name), ''), 'Nepoznato'),
      NULLIF(TRIM(COALESCE(p_last_name, '')), ''),
      p_phone,
      NULLIF(TRIM(COALESCE(p_email, '')), ''),
      NULLIF(TRIM(COALESCE(p_parent_name, '')), ''),
      NULLIF(TRIM(COALESCE(p_medical_alerts, '')), ''),
      NULLIF(TRIM(COALESCE(p_notes, '')), ''),
      COALESCE(NULLIF(p_category, ''), 'regular'),
      NULLIF(TRIM(p_chart_number), '')
    )
    RETURNING patients.id INTO v_existing_id;

    RETURN QUERY SELECT v_existing_id, 'inserted'::TEXT;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_patient_by_chart(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
