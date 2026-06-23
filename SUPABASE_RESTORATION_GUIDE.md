# 📋 Uputstvo za Obnovu Supabase Projekta (SP Dent)

Pošto je stari Supabase projekat obrisan, potrebno je da kreiraš novi projekat i povežeš ga sa aplikacijom i SMS worker-om. Prati ove jednostavne korake redom:

---

### Korak 1: Kreiranje novog Supabase projekta
1. Idi na [Supabase Dashboard](https://supabase.com/dashboard) i prijavi se.
2. Klikni na dugme **New Project** i izaberi svoju organizaciju.
3. Unesi podatke za projekat:
   - **Name:** npr. `SP dent`
   - **Database Password:** Unesi jaku lozinku (i sačuvaj je negde!).
   - **Region:** Izaberi region koji je geografski najbliži Srbiji (npr. *Frankfurt* ili *Zurich*).
4. Klikni **Create new project** i sačekaj nekoliko minuta da se baza instalira.

---

### Korak 2: Pokretanje baze podataka (SQL šema)
1. Kada se projekat kreira, sa leve strane menija izaberi **SQL Editor** (ikona sa znakom `SQL`).
2. Klikni na dugme **New query** (ili "Create a new query").
3. Otvori fajl `supabase/master_schema.sql` koji sam ti kreirao u projektu. Kopiraj **ceo** njegov sadržaj.
4. Nalepi kopirani kod u SQL Editor u Supabase-u.
5. Klikni na dugme **Run** (dole desno).
   - Treba da dobiješ poruku: `Success. No rows returned.`
   - *Ovim su kreirane sve tabele, indeksi, sigurnosne politike (RLS) i funkcije.*

---

### Korak 3: Podešavanje autentifikacije i kreiranje korisnika
1. U levom meniju Supabase Dashboard-a idi na **Authentication** (ikona sa siluetom osobe).
2. Idi pod karticu **Providers** i proveri da li je **Email** omogućen (Enabled). Trebalo bi da jeste po default-u.
   - *Preporuka:* Isključi opciju **Confirm email** pod podešavanjima Email provider-a ukoliko ne želiš da potvrđuješ email adrese preko linka, pa klikni **Save**.
3. Idi na karticu **Users** i klikni na **Add user** -> **Create user**.
4. Unesi email i lozinku sa kojom ćeš se prijavljivati na sajt zubarske ordinacije (CRM).
5. Kada se korisnik kreira, u tabeli će se pojaviti kolona **User UID** (dugačak niz brojeva i slova, npr. `8c7b80a1-4fd3...`).
6. **Kopiraj taj User UID**.

---

### Korak 4: Dodavanje admin privilegija i demo podataka
1. Otvori fajl `supabase/seed_demo_clean.sql` u svom VS Code-u.
2. Na **liniji 9** zameni tekst `'TVOJ-UUID-OVDE'` sa tvojim kopiranim **User UID**-om (zadrži jednostruke navodnike!).
3. Kopiraj **ceo** sadržaj fajla `seed_demo_clean.sql`.
4. Vrati se u Supabase **SQL Editor**, otvori novi upit (**New query**), nalepi kopirani kod i klikni **Run**.
   - *Ovo će ubaciti tvoj nalog u tabelu ovlašćenih korisnika i dodati nekoliko demo pacijenata i termina.*

---

### Korak 5: Kreiranje Storage Bucketa za rentgenske snimke (Ortopan)
1. U levom meniju izaberi **Storage** (ikona kante/kutije).
2. Klikni na **New bucket** (ili "Create bucket").
3. Unesi tačan naziv: `xrays` (mora biti ispisano malim slovima!).
4. Ostavi opciju **Public** isključenu (naše sigurnosne politike će kontrolisati pristup).
5. Klikni **Save** ili **Create bucket**.
6. Kada se kreira bucket, u levoj navigaciji (pod sekcijom **Configuration**) klikni na **Policies**.
7. Na stranici sa politikama videćeš tabelu za tvoj bucket `xrays`. Pored njega klikni na dugme **New Policy**.
8. Pojaviće se prozor sa dve opcije. Klikni na **Create a policy from scratch** (takođe piše *For full customization*).
9. **KREIRANJE PRVOG PRAVILA — ZA SLANJE SLIKA (INSERT):**
   - **Policy name (Naziv):** Unesi `Omogući slanje za admin korisnike`
   - **Allowed operations (Dozvoljene operacije):** Štikliraj samo kućicu **INSERT** (ostale ostavi prazne).
   - **Target roles (Ciljne uloge):** Klikni i izaberi **authenticated** sa liste (ovo znači da korisnik mora biti ulogovan).
   - **WITH CHECK expression (SQL polje):** Nalepi sledeći kod (PAŽNJA: Kopiraj samo liniju ispod, **bez** backtick oznaka ```sql i ```):
     ```sql
     (auth.role() = 'authenticated'::text) AND (EXISTS (SELECT 1 FROM public.admin_users WHERE (admin_users.user_id = auth.uid())))
     ```
   - Klikni na dugme **Save policy** na dnu.

10. **KREIRANJE DRUGOG PRAVILA — ZA PREGLED SLIKA (SELECT):**
    - Ponovo pod delom za `xrays` klikni na dugme **New Policy**.
    - Opet izaberi **Create a policy from scratch**.
    - **Policy name (Naziv):** Unesi `Omogući čitanje za admin korisnike`
    - **Allowed operations (Dozvoljene operacije):** Štikliraj samo kućicu **SELECT** (ostale ostavi prazne).
    - **Target roles (Ciljne uloge):** Izaberi **authenticated**.
    - **USING expression (SQL polje):** Nalepi sledeći kod (PAŽNJA: Kopiraj samo liniju ispod, **bez** backtick oznaka ```sql i ```):
      ```sql
      (auth.role() = 'authenticated'::text) AND (EXISTS (SELECT 1 FROM public.admin_users WHERE (admin_users.user_id = auth.uid())))
      ```
    - Klikni na dugme **Save policy** na dnu.

---

### Korak 6: Ažuriranje API ključeva u aplikaciji (`.env.local`)
1. Idi na **Project Settings** (ikona zupčanika u levom meniju) -> **API**.
2. Kopiraj **Project URL** i **Project API keys**:
   - `Project URL` (URL adresa projekta)
   - `anon public` (javni anonimni ključ)
   - `service_role` (tajni ključ za server - klikni na "Reveal" da ga vidiš!)
3. Otvori fajl `.env.local` u korenu tvog projekta.
4. Zameni stare vrednosti novim vrednostima:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tvoj_novi_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tvoj_novi_anon_public_key
   SUPABASE_SERVICE_ROLE_KEY=tvoj_novi_service_role_key
   ```
5. Sačuvaj fajl.
6. **VAŽNO:** Ugasiti Next.js server ako je bio upaljen, i pokrenuti ga ponovo sa `npm run dev` kako bi Next.js učitao nove ključeve iz `.env.local` fajla.

---

### Korak 7: Ažuriranje ključeva u SMS Worker-u (`sms_worker/.env`)
1. Otvori fajl `sms_worker/.env` (ili ako ne postoji, preimenuj `.env.example` u `.env` u tom folderu).
2. Unesi nove ključeve:
   ```env
   SUPABASE_URL=tvoj_novi_project_url
   SUPABASE_SERVICE_ROLE_KEY=tvoj_novi_service_role_key
   SMS_GATEWAY_URL=http://192.168.1.15:8080/send-sms
   SMS_GATEWAY_TOKEN=
   ```
   *(Zameni IP adresu ukoliko se IP adresa Android telefona promenila).*
3. Sačuvaj fajl.

---

### Korak 8: Pokretanje i testiranje
1. Pokreni Next.js aplikaciju u terminalu:
   ```bash
   npm run dev
   ```
2. Otvori `http://localhost:3000/admin` u brauzeru.
3. Prijavi se email-om i lozinkom koju si kreirao u Koraku 3.
4. Trebalo bi da vidiš kontrolnu tablu sa demo pacijentima i terminima.
5. Pokreni SMS worker u terminalu (u folderu `sms_worker`):
   ```bash
   python reminder.py
   ```
   *(Prethodno instaliraj pakete ako već nisu: `pip install -r requirements.txt`).*
