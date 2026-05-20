-- =============================================================================
-- SP DENT CRM — MASTER SQL MIGRACIJA (V3.0)
-- 100% BEZBEDAN ZA POKRETANJE: Rešava problem nepostojeće tabele
-- i spaja sve prethodne nadogradnje u jedan sveobuhvatan skript.
-- 
-- UPUTSTVO: Kopiraj ceo ovaj fajl, nalepi u Supabase SQL Editor → Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. KREIRANJE TABELE KLINIČKIH IZVEŠTAJA (Ako ne postoji)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinical_reports (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  anamneza       TEXT,
  nalaz          TEXT,
  terapija       TEXT,
  savet          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger za automatsko ažuriranje updated_at na izveštajima
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS clinical_reports_updated_at ON public.clinical_reports;
CREATE TRIGGER clinical_reports_updated_at
  BEFORE UPDATE ON public.clinical_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indeks za brzu pretragu izveštaja po pacijentu
CREATE INDEX IF NOT EXISTS clinical_reports_patient_id_idx
  ON public.clinical_reports(patient_id);

-- -----------------------------------------------------------------------------
-- 2. UKLANJANJE DUG - STUPCA (Zamenjeno boljim CRM sistemom)
-- -----------------------------------------------------------------------------
ALTER TABLE public.patients DROP COLUMN IF EXISTS total_debt;

-- -----------------------------------------------------------------------------
-- 3. JEDINSTVENI KLJUČ ZA TELEFON (Neophodan za Excel uvoz i izbegavanje dupliranja)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'patients_phone_key'
      AND table_name = 'patients'
  ) THEN
    ALTER TABLE public.patients 
      ADD CONSTRAINT patients_phone_key UNIQUE (phone);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN
    -- Već postoji, preskoči
    NULL;
  WHEN others THEN
    -- Ako ima duplih telefona, ispisaće upozorenje ali neće srušiti ostatak migracije
    RAISE NOTICE 'Nije moguće dodati UNIQUE na telefon jer već imaš duple brojeve u bazi.';
END $$;

-- -----------------------------------------------------------------------------
-- 4. PATIENTS: Dodavanje kategorije tretmana
-- Postojeći pacijenti automatski dobijaju 'regular'
-- -----------------------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'regular';

-- Dodaj CHECK constraint za kategorije
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'patients_category_check'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_category_check
      CHECK (category IN ('regular', 'implant', 'proteza'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5. CLINICAL_REPORTS: Proširenje za V3.0 (Doktor, Usluge i Budući Plan)
-- -----------------------------------------------------------------------------
ALTER TABLE public.clinical_reports
  ADD COLUMN IF NOT EXISTS doctor_name        TEXT,
  ADD COLUMN IF NOT EXISTS services_provided  TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS future_treatment_plan TEXT;

-- -----------------------------------------------------------------------------
-- 6. APPOINTMENTS: Dodavanje ordinirajućeg lekara pri zakazivanju
-- -----------------------------------------------------------------------------
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS doctor_name TEXT;

-- -----------------------------------------------------------------------------
-- 7. SIGURNOST (RLS) ZA KLINIČKE IZVEŠTAJE
-- -----------------------------------------------------------------------------
ALTER TABLE public.clinical_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can select clinical_reports" ON public.clinical_reports;
DROP POLICY IF EXISTS "Admin can insert clinical_reports" ON public.clinical_reports;
DROP POLICY IF EXISTS "Admin can update clinical_reports" ON public.clinical_reports;
DROP POLICY IF EXISTS "Admin can delete clinical_reports" ON public.clinical_reports;

CREATE POLICY "Admin can select clinical_reports"
  ON public.clinical_reports FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert clinical_reports"
  ON public.clinical_reports FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update clinical_reports"
  ON public.clinical_reports FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin can delete clinical_reports"
  ON public.clinical_reports FOR DELETE TO authenticated USING (is_admin());

REVOKE ALL ON public.clinical_reports FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_reports TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. INDEKSI ZA PERFORMANSE I PRETRAGU
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS patients_category_idx
  ON public.patients(category);

CREATE INDEX IF NOT EXISTS patients_created_at_idx
  ON public.patients(created_at DESC);

CREATE INDEX IF NOT EXISTS clinical_reports_doctor_idx
  ON public.clinical_reports(doctor_name);

CREATE INDEX IF NOT EXISTS clinical_reports_patient_created_idx
  ON public.clinical_reports(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS appointments_doctor_idx
  ON public.appointments(doctor_name);

-- -----------------------------------------------------------------------------
-- 9. VERIFIKACIJA USPEŠNOSTI
-- -----------------------------------------------------------------------------
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('patients', 'clinical_reports', 'appointments')
  AND column_name IN ('category', 'doctor_name', 'services_provided', 'future_treatment_plan')
ORDER BY table_name, column_name;
