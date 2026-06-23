-- =============================================================================
-- SP DENT — MASTER DATABASE SCHEMA (CONSOLIDATED V4.0)
-- Run this entire script ONCE in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADMIN USERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id   UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name      TEXT  NOT NULL,
  role      TEXT  NOT NULL DEFAULT 'staff'
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read own record" ON public.admin_users;
CREATE POLICY "Staff can read own record"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 2. HELPER FUNCTION — is_admin()
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. PATIENTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patients (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name           TEXT          NOT NULL,
  phone                TEXT          NOT NULL UNIQUE,
  last_name            TEXT,
  email                TEXT,
  parent_name          TEXT,
  medical_alerts       TEXT,
  notes                TEXT,
  category             TEXT          NOT NULL DEFAULT 'regular'
    CHECK (category IN ('regular', 'implant', 'proteza')),
  has_hypertension     BOOLEAN       NOT NULL DEFAULT false,
  has_diabetes         BOOLEAN       NOT NULL DEFAULT false,
  takes_anticoagulants BOOLEAN       NOT NULL DEFAULT false,
  penicillin_allergy   BOOLEAN       NOT NULL DEFAULT false,
  consent_signed       BOOLEAN       NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. APPOINTMENTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id           UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_datetime TIMESTAMPTZ NOT NULL,
  doctor_name          TEXT,
  treatment_today      TEXT,
  treatment_history    TEXT[]      NOT NULL DEFAULT '{}',
  reminder_sent        BOOLEAN     NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 5. CLINICAL REPORTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinical_reports (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_name           TEXT,
  anamneza              TEXT,
  nalaz                 TEXT,
  terapija              TEXT,
  savet                 TEXT,
  services_provided     TEXT[]      NOT NULL DEFAULT '{}',
  future_treatment_plan TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 6. TOOTH STATUS TABLE (Dental Chart - FDI notation)
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

-- -----------------------------------------------------------------------------
-- 7. SYSTEM LOGS TABLE
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

-- -----------------------------------------------------------------------------
-- 8. AUTO-UPDATE triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS patients_updated_at ON public.patients;
CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS clinical_reports_updated_at ON public.clinical_reports;
CREATE TRIGGER clinical_reports_updated_at
  BEFORE UPDATE ON public.clinical_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tooth_status_updated_at ON public.tooth_status;
CREATE TRIGGER tooth_status_updated_at
  BEFORE UPDATE ON public.tooth_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 9. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS patients_category_idx
  ON public.patients(category);

CREATE INDEX IF NOT EXISTS patients_created_at_idx
  ON public.patients(created_at DESC);

CREATE INDEX IF NOT EXISTS appointments_patient_id_idx
  ON public.appointments(patient_id);

CREATE INDEX IF NOT EXISTS appointments_datetime_reminder_idx
  ON public.appointments(appointment_datetime, reminder_sent)
  WHERE reminder_sent = false;

CREATE INDEX IF NOT EXISTS appointments_doctor_idx
  ON public.appointments(doctor_name);

CREATE INDEX IF NOT EXISTS clinical_reports_patient_id_idx
  ON public.clinical_reports(patient_id);

CREATE INDEX IF NOT EXISTS clinical_reports_doctor_idx
  ON public.clinical_reports(doctor_name);

CREATE INDEX IF NOT EXISTS clinical_reports_patient_created_idx
  ON public.clinical_reports(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tooth_status_patient_idx
  ON public.tooth_status(patient_id);

CREATE INDEX IF NOT EXISTS tooth_status_number_idx
  ON public.tooth_status(tooth_number);

CREATE INDEX IF NOT EXISTS system_logs_level_idx
  ON public.system_logs(level);

CREATE INDEX IF NOT EXISTS system_logs_created_at_idx
  ON public.system_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS system_logs_component_idx
  ON public.system_logs(component);

-- -----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.patients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tooth_status     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs       ENABLE ROW LEVEL SECURITY;

-- Patients policies
DROP POLICY IF EXISTS "Admin can select patients" ON public.patients;
DROP POLICY IF EXISTS "Admin can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Admin can update patients" ON public.patients;
DROP POLICY IF EXISTS "Admin can delete patients" ON public.patients;

CREATE POLICY "Admin can select patients"
  ON public.patients FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert patients"
  ON public.patients FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update patients"
  ON public.patients FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin can delete patients"
  ON public.patients FOR DELETE TO authenticated USING (is_admin());

-- Appointments policies
DROP POLICY IF EXISTS "Admin can select appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admin can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admin can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admin can delete appointments" ON public.appointments;

CREATE POLICY "Admin can select appointments"
  ON public.appointments FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert appointments"
  ON public.appointments FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update appointments"
  ON public.appointments FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin can delete appointments"
  ON public.appointments FOR DELETE TO authenticated USING (is_admin());

-- Clinical reports policies
DROP POLICY IF EXISTS "Admin can select clinical_reports" ON public.clinical_reports;
DROP POLICY IF EXISTS "Admin can insert clinical_reports" ON public.clinical_reports;
DROP POLICY IF EXISTS "Admin can update clinical_reports" ON public.clinical_reports;
DROP POLICY IF EXISTS "Admin can delete clinical_reports" ON public.clinical_reports;

CREATE POLICY "Admin can select clinical_reports"
  ON public.clinical_reports FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert clinical_reports"
  ON public.clinical_reports FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update clinical_reports"
  ON public.clinical_reports FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin can delete clinical_reports"
  ON public.clinical_reports FOR DELETE TO authenticated USING (is_admin());

-- Tooth status policies
DROP POLICY IF EXISTS "Admin can manage tooth_status" ON public.tooth_status;
CREATE POLICY "Admin can manage tooth_status"
  ON public.tooth_status FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- System logs policies
DROP POLICY IF EXISTS "Admin can read system_logs" ON public.system_logs;
CREATE POLICY "Admin can read system_logs"
  ON public.system_logs FOR SELECT TO authenticated USING (is_admin());

-- -----------------------------------------------------------------------------
-- 11. REVOKE/GRANT PRIVILEGES (Block anonymous access)
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.patients         FROM anon;
REVOKE ALL ON public.appointments     FROM anon;
REVOKE ALL ON public.clinical_reports FROM anon;
REVOKE ALL ON public.tooth_status     FROM anon;
REVOKE ALL ON public.system_logs       FROM anon;
REVOKE ALL ON public.admin_users      FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tooth_status     TO authenticated;
GRANT SELECT, INSERT                 ON public.system_logs       TO authenticated;
GRANT SELECT                         ON public.admin_users      TO authenticated;

-- -----------------------------------------------------------------------------
-- 12. RPC FUNCTION — prepend_treatment_history
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepend_treatment_history(
  p_appointment_id UUID,
  p_entry          TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER  -- Runs as the calling user, RLS still applies
AS $$
DECLARE
  v_patient_id UUID;
BEGIN
  UPDATE public.appointments
  SET    treatment_history = array_cat(ARRAY[p_entry], treatment_history)
  WHERE  id = p_appointment_id
  RETURNING patient_id INTO v_patient_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment % not found', p_appointment_id;
  END IF;

  RETURN v_patient_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prepend_treatment_history(UUID, TEXT) TO authenticated;
