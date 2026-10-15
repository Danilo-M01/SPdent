-- ============================================================================
-- SP DENT: SQL Skripta za Ažuriranje Baze (Broj Kartona, Indeksi i Čišćenje)
-- Pokrenite ovu skriptu u Supabase SQL Editor-u:
-- Dashboard -> SQL Editor -> New Query -> Paste & Run
-- ============================================================================

-- 1. Dodavanje kolone chart_number ukoliko već ne postoji
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS chart_number TEXT;

-- 2. Kreiranje brzog indeksa za instant pretragu po broju kartona
CREATE INDEX IF NOT EXISTS idx_patients_chart_number 
ON public.patients (LOWER(TRIM(chart_number))) 
WHERE chart_number IS NOT NULL;

-- 3. Kreiranje indeksa za brzi lookup po telefonu
CREATE INDEX IF NOT EXISTS idx_patients_phone 
ON public.patients (phone);

-- 4. RPC funkcija za atomski upsert po broju kartona (opciono, za maksimalnu brzinu baze)
CREATE OR REPLACE FUNCTION public.upsert_patient_by_chart(
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_parent_name TEXT,
  p_medical_alerts TEXT,
  p_notes TEXT,
  p_category TEXT,
  p_chart_number TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id UUID;
  v_existing_id UUID;
  v_existing_phone TEXT;
  v_existing_notes TEXT;
  v_merged_notes TEXT;
  v_phone_to_use TEXT;
BEGIN
  -- 1. Potraži da li već postoji pacijent sa ovim brojem kartona
  SELECT id, phone, notes INTO v_existing_id, v_existing_phone, v_existing_notes
  FROM public.patients
  WHERE LOWER(TRIM(chart_number)) = LOWER(TRIM(p_chart_number))
  LIMIT 1;

  -- 2. Ako nije nađen po kartonu, a prosleđen je validan telefon, potraži po telefonu
  IF v_existing_id IS NULL AND p_phone IS NOT NULL AND p_phone != '/' AND p_phone NOT LIKE '/-no-phone-%' THEN
    SELECT id, phone, notes INTO v_existing_id, v_existing_phone, v_existing_notes
    FROM public.patients
    WHERE phone = p_phone
    LIMIT 1;
  END IF;

  -- 3. Ako pacijent postoji -> AŽURIRAJ (Smart Merge)
  IF v_existing_id IS NOT NULL THEN
    -- Pametno spajanje napomena
    IF p_notes IS NOT NULL AND TRIM(p_notes) != '' THEN
      IF v_existing_notes IS NOT NULL AND v_existing_notes NOT LIKE '%' || TRIM(p_notes) || '%' THEN
        v_merged_notes := TRIM(p_notes) || ' | ' || v_existing_notes;
      ELSE
        v_merged_notes := COALESCE(v_existing_notes, TRIM(p_notes));
      END IF;
    ELSE
      v_merged_notes := v_existing_notes;
    END IF;

    -- Ako novi zapis ima pravi telefon, a stari je bio dummy '/-no-phone-', ažuriraj telefon
    IF p_phone IS NOT NULL AND p_phone != '/' AND p_phone NOT LIKE '/-no-phone-%' THEN
      v_phone_to_use := p_phone;
    ELSE
      v_phone_to_use := v_existing_phone;
    END IF;

    UPDATE public.patients
    SET
      first_name = COALESCE(NULLIF(TRIM(p_first_name), ''), first_name),
      last_name = COALESCE(NULLIF(TRIM(p_last_name), ''), last_name),
      phone = v_phone_to_use,
      email = COALESCE(NULLIF(TRIM(p_email), ''), email),
      parent_name = COALESCE(NULLIF(TRIM(p_parent_name), ''), parent_name),
      medical_alerts = COALESCE(NULLIF(TRIM(p_medical_alerts), ''), medical_alerts),
      notes = v_merged_notes,
      category = CASE WHEN p_category IS NOT NULL AND p_category != 'regular' THEN p_category ELSE category END,
      chart_number = TRIM(p_chart_number),
      updated_at = NOW()
    WHERE id = v_existing_id;

    RETURN jsonb_build_object('id', v_existing_id, 'action', 'updated');
  ELSE
    -- 4. Ako ne postoji -> UBACI NOVOG
    INSERT INTO public.patients (
      first_name,
      last_name,
      phone,
      email,
      parent_name,
      medical_alerts,
      notes,
      category,
      chart_number,
      created_at,
      updated_at
    ) VALUES (
      TRIM(p_first_name),
      NULLIF(TRIM(p_last_name), ''),
      p_phone,
      NULLIF(TRIM(p_email), ''),
      NULLIF(TRIM(p_parent_name), ''),
      NULLIF(TRIM(p_medical_alerts), ''),
      NULLIF(TRIM(p_notes), ''),
      COALESCE(NULLIF(TRIM(p_category), ''), 'regular'),
      TRIM(p_chart_number),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_patient_id;

    RETURN jsonb_build_object('id', v_patient_id, 'action', 'inserted');
  END IF;
END;
$$;

-- 5. Bezbedno čišćenje duplikata bez telefona (nastali ranijim uvozima sa nasumičnim ID-jevima)
-- Ova komanda zadržava najstariji unos (originalnog pacijenta) i briše samo višestruke duplikate
WITH duplicate_patients AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(TRIM(first_name)), COALESCE(LOWER(TRIM(last_name)), ''), COALESCE(LOWER(TRIM(notes)), '')
           ORDER BY created_at ASC
         ) as rank_order
  FROM public.patients
  WHERE phone LIKE '/-no-phone-%' OR phone = '/'
)
DELETE FROM public.patients
WHERE id IN (
  SELECT id FROM duplicate_patients WHERE rank_order > 1
);
