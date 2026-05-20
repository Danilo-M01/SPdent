-- =============================================================================
-- SP DENT — Dental CRM Database Schema v2.0
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR TO UPGRADE THE DB
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. UPGRADE PATIENTS TABLE (Remove total_debt)
-- -----------------------------------------------------------------------------
ALTER TABLE public.patients DROP COLUMN IF EXISTS total_debt;

-- -----------------------------------------------------------------------------
-- 2. CREATE CLINICAL REPORTS TABLE
-- Used for the full medical dossier, replacing the old text array.
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

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS clinical_reports_updated_at ON public.clinical_reports;
CREATE TRIGGER clinical_reports_updated_at
  BEFORE UPDATE ON public.clinical_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS clinical_reports_patient_id_idx
  ON public.clinical_reports(patient_id);

-- -----------------------------------------------------------------------------
-- 3. ENABLE RLS FOR CLINICAL REPORTS
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
