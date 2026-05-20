-- =============================================================================
-- SP DENT — Demo Seed Podaci
-- 1. Zameni TVOJ-UUID-OVDE sa tvojim UUID-om iz Supabase Authentication
-- 2. Pokreni ovaj SQL u SQL Editoru
-- =============================================================================

-- Dodaj sebe kao admina
INSERT INTO public.admin_users (user_id, name, role) VALUES
  ('TVOJ-UUID-OVDE', 'Admin Demo', 'doctor')
ON CONFLICT (user_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Demo pacijenti
-- -----------------------------------------------------------------------------
INSERT INTO public.patients (id, first_name, last_name, phone, email, medical_alerts, total_debt, notes) VALUES
  (
    'aaaaaaaa-0001-0001-0001-000000000001',
    'Marko', 'Petrović',
    '+381 60 123 4567',
    'marko.petrovic@gmail.com',
    NULL,
    0.00,
    'Redovan pacijent, dobra oralna higijena'
  ),
  (
    'aaaaaaaa-0002-0002-0002-000000000002',
    'Ana', 'Jovanović',
    '+381 64 987 6543',
    'ana.j@gmail.com',
    'Alergija na penicilin! Koristiti alternativni antibiotik.',
    15000.00,
    'Preosjetljiva na bol, koristiti više anestezije'
  ),
  (
    'aaaaaaaa-0003-0003-0003-000000000003',
    'Stefan', 'Nikolić',
    '+381 63 555 7890',
    NULL,
    NULL,
    8500.00,
    NULL
  ),
  (
    'aaaaaaaa-0004-0004-0004-000000000004',
    'Milica', 'Đorđević',
    '+381 65 321 0987',
    'milica.d@yahoo.com',
    'Dijabetes tip 2 — oprez pri ekstrakciji, sporo zarastanje. Alergija na latex rukavice.',
    0.00,
    'Dolazi sa majkom Gordanom'
  ),
  (
    'aaaaaaaa-0005-0005-0005-000000000005',
    'Jovana', 'Stojanović',
    '+381 61 444 2222',
    'jovana.s@gmail.com',
    NULL,
    3200.00,
    'Pacijentkinja od 2021. godine'
  ),
  (
    'aaaaaaaa-0006-0006-0006-000000000006',
    'Nikola', 'Marinković',
    '+381 60 777 3333',
    NULL,
    'Strah od bušenja — anksioznost. Premedikacija preporučena.',
    0.00,
    'Zakazati duži termin'
  );

-- -----------------------------------------------------------------------------
-- Demo termini (za sutra i naredne dane — SMS worker ce ih pokupiti)
-- -----------------------------------------------------------------------------
INSERT INTO public.appointments (patient_id, appointment_datetime, treatment_today, treatment_history, reminder_sent) VALUES
  (
    'aaaaaaaa-0001-0001-0001-000000000001',
    (NOW() + INTERVAL '1 day')::date + TIME '10:00:00',
    'Kontrolni pregled',
    ARRAY[
      '[16.05.2026. 09:30] Plombiranje zuba 36 — kompozit, bez komplikacija',
      '[02.03.2026. 11:00] Čišćenje kamenca i poliranje'
    ],
    false
  ),
  (
    'aaaaaaaa-0002-0002-0002-000000000002',
    (NOW() + INTERVAL '1 day')::date + TIME '11:30:00',
    'Nastavak terapije kanala',
    ARRAY[
      '[15.05.2026. 14:00] Početak endodontske terapije zuba 46 — aplikovana Ca(OH)2 pasta',
      '[20.04.2026. 10:30] Ekstrakcija zuba 47 — bez komplikacija, pažnja zbog alergije na penicilin!'
    ],
    false
  ),
  (
    'aaaaaaaa-0004-0004-0004-000000000004',
    (NOW() + INTERVAL '2 days')::date + TIME '09:00:00',
    'Ugradnja krunice',
    ARRAY[
      '[14.05.2026. 16:00] Brušenje zuba 11 za krunicu — otisak poslat u laboratoriju'
    ],
    false
  ),
  (
    'aaaaaaaa-0003-0003-0003-000000000003',
    (NOW() + INTERVAL '3 days')::date + TIME '14:00:00',
    'Izbjeljivanje',
    ARRAY[
      '[10.05.2026. 09:00] Konsultacija — dogovoren tretman izbeljivanja'
    ],
    false
  ),
  (
    'aaaaaaaa-0005-0005-0005-000000000005',
    (NOW() + INTERVAL '1 day')::date + TIME '15:30:00',
    'Postavljanje fasete',
    ARRAY[
      '[12.05.2026. 11:00] Priprema za fasete zubi 21 i 22'
    ],
    false
  );

-- =============================================================================
-- GOTOVO! Otvori http://localhost:3000/admin i prijavi se
-- =============================================================================
