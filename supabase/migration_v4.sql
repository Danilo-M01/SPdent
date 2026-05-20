-- =============================================================================
-- SP DENT CRM — MIGRATION V4.0
-- Dodaje: sistematska anamneza, dental chart, system logs
-- SIGURAN ZA POKRETANJE NA POSTOJEĆOJ BAZI
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PATIENTS: Sistematska anamneza + saglasnost
-- -----------------------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS has_hypertension      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_diabetes          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS takes_anticoagulants  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS penicillin_allergy    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_signed        BOOLEAN NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- 2. TOOTH STATUS TABLE — FDI dvocifrena notacija (11-18, 21-28, 31-38, 41-48)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tooth_status (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  tooth_number INT         NOT NULL CHECK (tooth_number BETWEEN 11 AND 48),
  status       TEXT        NOT NULL DEFAULT 'healthy'
    CHECK (status IN ('healthy', 'caries', 'filled', 'missing', 'implant', 'crown')),
  notes        TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, tooth_number)
);

DROP TRIGGER IF EXISTS tooth_status_updated_at ON public.tooth_status;
CREATE TRIGGER tooth_status_updated_at
  BEFORE UPDATE ON public.tooth_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS tooth_status_patient_idx ON public.tooth_status(patient_id);
CREATE INDEX IF NOT EXISTS tooth_status_number_idx  ON public.tooth_status(tooth_number);

ALTER TABLE public.tooth_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can manage tooth_status" ON public.tooth_status;
CREATE POLICY "Admin can manage tooth_status"
  ON public.tooth_status FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
REVOKE ALL ON public.tooth_status FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tooth_status TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. SYSTEM LOGS TABLE — Developer monitoring
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  level      TEXT        NOT NULL DEFAULT 'INFO'
    CHECK (level IN ('INFO', 'WARN', 'CRITICAL')),
  message    TEXT        NOT NULL,
  component  TEXT,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS system_logs_level_idx      ON public.system_logs(level);
CREATE INDEX IF NOT EXISTS system_logs_created_at_idx ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS system_logs_component_idx  ON public.system_logs(component);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can read system_logs" ON public.system_logs;
CREATE POLICY "Admin can read system_logs"
  ON public.system_logs FOR SELECT TO authenticated USING (is_admin());
-- Logs are written via service role only (Python worker, server actions)
REVOKE ALL ON public.system_logs FROM anon;
GRANT SELECT ON public.system_logs TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. SUPABASE STORAGE BUCKET za X-ray / Ortopan slike
-- (Ovo se kreira kroz Supabase Dashboard > Storage > Create bucket,
--  ali ovde definišemo RLS Policy koji ce biti primenjen nakon kreiranja bucketa)
-- -----------------------------------------------------------------------------
-- Bucket naziv: xrays
-- Ovu politiku primeni u: Storage > xrays > Policies > INSERT + SELECT
-- INSERT: (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
-- SELECT: (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))

-- -----------------------------------------------------------------------------
-- 5. VERIFIKACIJA
-- -----------------------------------------------------------------------------
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('patients', 'tooth_status', 'system_logs')
  AND column_name IN (
    'has_hypertension', 'has_diabetes', 'takes_anticoagulants',
    'penicillin_allergy', 'consent_signed', 'tooth_number',
    'status', 'level', 'message', 'component'
  )
ORDER BY table_name, column_name;
