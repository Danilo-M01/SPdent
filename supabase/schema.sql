-- =============================================================================
-- SP DENT — Dental CRM Database Schema
-- Pokreni ceo ovaj SQL u Supabase SQL Editoru (jednom)
-- Posle toga, dodaj korisnike rucno u tabelu admin_users
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADMIN USERS TABELA
-- Ovde ces dodavati/uklanjati zaposlene koji imaju pristup CRM-u
-- Nema UUID-ova u kodu — sve se menja kroz ovu tabelu
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id   UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name      TEXT  NOT NULL,
  role      TEXT  NOT NULL DEFAULT 'staff'
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users FORCE ROW LEVEL SECURITY;

-- Svako moze da vidi samo svoj red (za internu proveru)
DROP POLICY IF EXISTS "Staff can read own record" ON public.admin_users;
CREATE POLICY "Staff can read own record"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 2. POMOCNA FUNKCIJA — proverava da li je prijavljeni korisnik u admin_users
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
-- 3. TABELA PACIJENATA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patients (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name           TEXT          NOT NULL,
  phone                TEXT          NOT NULL UNIQUE,
  last_name            TEXT,
  email                TEXT,
  parent_name          TEXT,
  medical_alerts       TEXT,
  total_debt           NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  notes                TEXT,
  category             TEXT          NOT NULL DEFAULT 'regular',
  has_hypertension     BOOLEAN       NOT NULL DEFAULT false,
  has_diabetes         BOOLEAN       NOT NULL DEFAULT false,
  takes_anticoagulants BOOLEAN       NOT NULL DEFAULT false,
  penicillin_allergy   BOOLEAN       NOT NULL DEFAULT false,
  consent_signed       BOOLEAN       NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. TABELA TERMINA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id           UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_datetime TIMESTAMPTZ NOT NULL,
  treatment_today      TEXT,
  treatment_history    TEXT[]      NOT NULL DEFAULT '{}',
  reminder_sent        BOOLEAN     NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4b. TABELA KLINIČKIH IZVEŠTAJA (CLINICAL REPORTS)
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
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4c. TABELA STATUSA ZUBA (TOOTH STATUS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tooth_status (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  tooth_number INT         NOT NULL CHECK (tooth_number >= 11 AND tooth_number <= 48),
  status       TEXT        NOT NULL DEFAULT 'healthy',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_id, tooth_number)
);

-- -----------------------------------------------------------------------------
-- 4d. TABELA SISTEMSKIH LOGOVA (SYSTEM LOGS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  level      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  component  TEXT,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 5. AUTO-UPDATE updated_at
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

-- -----------------------------------------------------------------------------
-- 6. INDEKSI (brzina pretrage)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS appointments_patient_id_idx
  ON public.appointments(patient_id);

CREATE INDEX IF NOT EXISTS appointments_datetime_reminder_idx
  ON public.appointments(appointment_datetime, reminder_sent)
  WHERE reminder_sent = false;

CREATE INDEX IF NOT EXISTS clinical_reports_patient_id_idx
  ON public.clinical_reports(patient_id);

CREATE INDEX IF NOT EXISTS tooth_status_patient_id_idx
  ON public.tooth_status(patient_id);

-- -----------------------------------------------------------------------------
-- 7. UKLJUCI ROW LEVEL SECURITY na svim tabelama
-- -----------------------------------------------------------------------------
ALTER TABLE public.patients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tooth_status     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs       ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 8. RLS POLITIKE — PATIENTS
-- Samo korisnici koji su u admin_users tabeli mogu da citaju/pisu
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can select patients" ON public.patients;
DROP POLICY IF EXISTS "Admin can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Admin can update patients" ON public.patients;
DROP POLICY IF EXISTS "Admin can delete patients" ON public.patients;

CREATE POLICY "Admin can select patients"
  ON public.patients FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert patients"
  ON public.patients FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update patients"
  ON public.patients FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin can delete patients"
  ON public.patients FOR DELETE TO authenticated USING (is_admin());

-- -----------------------------------------------------------------------------
-- 9. RLS POLITIKE — APPOINTMENTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can select appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admin can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admin can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admin can delete appointments" ON public.appointments;

CREATE POLICY "Admin can select appointments"
  ON public.appointments FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert appointments"
  ON public.appointments FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin can delete appointments"
  ON public.appointments FOR DELETE TO authenticated USING (is_admin());

-- -----------------------------------------------------------------------------
-- 9b. RLS POLITIKE — CLINICAL REPORTS
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 9c. RLS POLITIKE — TOOTH STATUS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can select tooth_status" ON public.tooth_status;
DROP POLICY IF EXISTS "Admin can insert tooth_status" ON public.tooth_status;
DROP POLICY IF EXISTS "Admin can update tooth_status" ON public.tooth_status;
DROP POLICY IF EXISTS "Admin can delete tooth_status" ON public.tooth_status;

CREATE POLICY "Admin can select tooth_status"
  ON public.tooth_status FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert tooth_status"
  ON public.tooth_status FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update tooth_status"
  ON public.tooth_status FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin can delete tooth_status"
  ON public.tooth_status FOR DELETE TO authenticated USING (is_admin());

-- -----------------------------------------------------------------------------
-- 9d. RLS POLITIKE — SYSTEM LOGS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can select system_logs" ON public.system_logs;
DROP POLICY IF EXISTS "Admin can insert system_logs" ON public.system_logs;

CREATE POLICY "Admin can select system_logs"
  ON public.system_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert system_logs"
  ON public.system_logs FOR INSERT TO authenticated WITH CHECK (is_admin());

-- -----------------------------------------------------------------------------
-- 10. BLOKIRANJE ANONIMNOG PRISTUPA & PRIVILEGIJE
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

-- =============================================================================
-- ATOMIC RPC: prepend_treatment_history
-- Called by actions.ts to prepend a new entry to treatment_history[].
-- Using a single UPDATE avoids the fetch→update race condition when
-- multiple staff log treatments concurrently.
-- Returns: the patient_id of the updated appointment (for cache revalidation)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.prepend_treatment_history(
  p_appointment_id UUID,
  p_entry          TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER  -- runs as the calling user, so RLS still applies
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

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.prepend_treatment_history(UUID, TEXT) TO authenticated;

-- =============================================================================
-- KRAJ SQL SKRIPTE
-- Sledeci korak: dodaj zaposlene u tabelu admin_users (vidi uputstvo ispod)
-- =============================================================================
