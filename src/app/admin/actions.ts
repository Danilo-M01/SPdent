'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import {
  sanitizeText,
  sanitizePhone,
  sanitizeEmail,
} from '@/lib/sanitize'

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

export type ActionResult = {
  success: boolean
  error?: string
  id?: string
}

// ---------------------------------------------------------------------------
// TIMEZONE HELPER
// ---------------------------------------------------------------------------

/**
 * Parses a local HTML 'YYYY-MM-DDTHH:mm' datetime string as Europe/Belgrade local time,
 * returning a Date object adjusted to the correct UTC timestamp.
 * This prevents shifts of 1-2 hours depending on DST when run on UTC servers.
 */
function parseBelgradeDateTime(raw: string): Date {
  const [datePart, timePart] = raw.split('T')
  if (!datePart || !timePart) return new Date(NaN)

  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)

  if (
    isNaN(year) || isNaN(month) || isNaN(day) ||
    isNaN(hour) || isNaN(minute)
  ) {
    return new Date(NaN)
  }

  // Construct a date in UTC representing the input wall time
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute))

  // Determine what that time would look like in Europe/Belgrade
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Belgrade',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  })

  const parts = formatter.formatToParts(utcDate)
  const fp: Record<string, number> = {}
  parts.forEach(p => { if (p.type !== 'literal') fp[p.type] = Number(p.value) })

  // Reconstruct a UTC date matching what the formatter returned
  const formattedDate = new Date(Date.UTC(fp.year, fp.month - 1, fp.day, fp.hour, fp.minute))

  // Subtract the offset to adjust back to true UTC
  const diffMs = utcDate.getTime() - formattedDate.getTime()
  return new Date(utcDate.getTime() + diffMs)
}

// ---------------------------------------------------------------------------
// AUTH ACTIONS
// ---------------------------------------------------------------------------

/**
 * Sign in with email + password via Supabase Auth.
 * Called from the login page form via useActionState.
 */
export async function signIn(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const email = sanitizeEmail(formData.get('email'))
    const password = String(formData.get('password') ?? '').trim()

    if (!email || !password) {
      return { success: false, error: 'Email i lozinka su obavezni.' }
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return { success: false, error: 'Pogrešan email ili lozinka.' }
    }
  } catch (err) {
    console.error('[signIn] Unexpected:', err)
    return { success: false, error: 'Došlo je do neočekivane greške.' }
  }

  redirect('/admin')
}

/**
 * Sign out and redirect to login.
 */
export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (err) {
    console.error('[signOut] Unexpected:', err)
  }
  redirect('/admin/login')
}

// ---------------------------------------------------------------------------
// PATIENT ACTIONS
// ---------------------------------------------------------------------------

/**
 * Add a new patient to the database.
 * All fields are sanitized before insertion.
 */
export async function addPatient(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const firstName = sanitizeText(formData.get('first_name'))
    const lastName = sanitizeText(formData.get('last_name'))
    let phone = sanitizePhone(formData.get('phone'))
    const email = sanitizeEmail(formData.get('email'))
    const parentName = sanitizeText(formData.get('parent_name'))
    const medicalAlerts = sanitizeText(formData.get('medical_alerts'))
    const notes = sanitizeText(formData.get('notes'))
    const category = sanitizeText(formData.get('category')) || 'regular'

    // Systemic anamnesis booleans — checkboxes send 'true' string when checked
    const hasHypertension    = formData.get('has_hypertension') === 'true'
    const hasDiabetes        = formData.get('has_diabetes') === 'true'
    const takesAnticoagulants = formData.get('takes_anticoagulants') === 'true'
    const penicillinAllergy  = formData.get('penicillin_allergy') === 'true'
    const consentSigned      = formData.get('consent_signed') === 'true'

    if (!firstName) return { success: false, error: 'Ime je obavezno.' }
    
    // If phone is missing, empty, or '/', generate a unique key starting with '/-no-phone-'
    if (!phone || phone === '/' || phone.startsWith('/')) {
      phone = `/-no-phone-${Math.random().toString(36).substring(2, 10)}`
    }

    const validCategories = ['regular', 'implant', 'proteza']
    const safeCategory = validCategories.includes(category) ? category : 'regular'

    const supabase = await createClient()
    const { data, error } = await supabase.from('patients').insert({
      first_name: firstName,
      last_name: lastName || null,
      phone,
      email: email || null,
      parent_name: parentName || null,
      medical_alerts: medicalAlerts || null,
      notes: notes || null,
      category: safeCategory,
      has_hypertension: hasHypertension,
      has_diabetes: hasDiabetes,
      takes_anticoagulants: takesAnticoagulants,
      penicillin_allergy: penicillinAllergy,
      consent_signed: consentSigned,
    }).select('id').single()

    if (error) {
      console.error('[addPatient] DB Error:', error.message)
      if (error.message.includes('unique') || error.code === '23505') {
        return { success: false, error: 'Pacijent sa ovim telefonom već postoji.' }
      }
      return { success: false, error: 'Greška pri dodavanju pacijenta.' }
    }

    revalidatePath('/admin')
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('[addPatient] Unexpected:', err)
    return { success: false, error: 'Došlo je do neočekivane greške na serveru.' }
  }
}

/**
 * Update patient information.
 */
export async function updatePatient(
  patientId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const validCategories = ['regular', 'implant', 'proteza']
    const rawCategory = sanitizeText(formData.get('category')) || 'regular'
    
    let phone = sanitizePhone(formData.get('phone'))
    if (!phone || phone === '/' || phone.startsWith('/')) {
      // Check if existing record had a generated phone, reuse it to avoid breaking uniqueness or duplicating
      const supabaseCheck = await createClient()
      const { data: currentPatient } = await supabaseCheck
        .from('patients')
        .select('phone')
        .eq('id', patientId)
        .single()

      if (currentPatient?.phone && currentPatient.phone.startsWith('/-no-phone-')) {
        phone = currentPatient.phone
      } else {
        phone = `/-no-phone-${Math.random().toString(36).substring(2, 10)}`
      }
    }

    const updates = {
      first_name: sanitizeText(formData.get('first_name')),
      last_name: sanitizeText(formData.get('last_name')) || null,
      phone,
      email: sanitizeEmail(formData.get('email')) || null,
      parent_name: sanitizeText(formData.get('parent_name')) || null,
      medical_alerts: sanitizeText(formData.get('medical_alerts')) || null,
      notes: sanitizeText(formData.get('notes')) || null,
      category: validCategories.includes(rawCategory) ? rawCategory : 'regular',
      has_hypertension: formData.get('has_hypertension') === 'true',
      has_diabetes: formData.get('has_diabetes') === 'true',
      takes_anticoagulants: formData.get('takes_anticoagulants') === 'true',
      penicillin_allergy: formData.get('penicillin_allergy') === 'true',
      consent_signed: formData.get('consent_signed') === 'true',
    }

    if (!updates.first_name) return { success: false, error: 'Ime je obavezno.' }

    const supabase = await createClient()
    const { error } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', patientId)

    if (error) {
      console.error('[updatePatient] DB Error:', error.message)
      if (error.message.includes('unique') || error.code === '23505') {
        return { success: false, error: 'Drugi pacijent već koristi ovaj broj telefona.' }
      }
      return { success: false, error: 'Greška pri ažuriranju pacijenta.' }
    }

    revalidatePath('/admin')
    revalidatePath(`/admin/patients/${patientId}`)
    return { success: true }
  } catch (err) {
    console.error('[updatePatient] Unexpected:', err)
    return { success: false, error: 'Došlo je do neočekivane greške na serveru.' }
  }
}

/**
 * Delete a patient (and all associated appointments via CASCADE).
 */
export async function deletePatient(patientId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('patients')
      .delete()
      .eq('id', patientId)

    if (error) {
      console.error('[deletePatient] DB Error:', error.message)
      return { success: false, error: error.message }
    }
  } catch (err) {
    console.error('[deletePatient] Unexpected:', err)
    return { success: false, error: 'Neočekivana greška pri brisanju.' }
  }

  revalidatePath('/admin')
  return { success: true }
}

// ---------------------------------------------------------------------------
// APPOINTMENT / TREATMENT ACTIONS
// ---------------------------------------------------------------------------

/**
 * Create a new appointment for a patient.
 */
export async function addAppointment(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const patientId = sanitizeText(formData.get('patient_id'))
    const datetimeRaw = String(formData.get('appointment_datetime') ?? '').trim()
    const treatmentToday = sanitizeText(formData.get('treatment_today'))
    const doctorName = sanitizeText(formData.get('doctor_name')) || null

    if (!patientId) return { success: false, error: 'Pacijent je obavezan.' }
    if (!datetimeRaw) return { success: false, error: 'Datum i vreme su obavezni.' }

    const dt = parseBelgradeDateTime(datetimeRaw)
    if (isNaN(dt.getTime())) {
      return { success: false, error: 'Neispravan datum ili vreme.' }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.from('appointments').insert({
      patient_id: patientId,
      appointment_datetime: dt.toISOString(),
      treatment_today: treatmentToday || null,
      treatment_history: [],
      reminder_sent: false,
      doctor_name: doctorName,
    }).select('id').single()

    if (error) {
      console.error('[addAppointment] DB Error:', error.message)
      return { success: false, error: 'Greška pri dodavanju termina.' }
    }

    revalidatePath('/admin')
    revalidatePath(`/admin/patients/${patientId}`)
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('[addAppointment] Unexpected:', err)
    return { success: false, error: 'Došlo je do neočekivane greške na serveru.' }
  }
}

/**
 * Log a treatment entry for an appointment.
 * Timestamp is in Europe/Belgrade timezone.
 *
 * ATOMIC: Uses a single PostgreSQL UPDATE with array_prepend via RPC,
 * eliminating the fetch→update race condition where two concurrent
 * writes could overwrite each other's history entries.
 */
export async function logTreatment(
  appointmentId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const rawText = sanitizeText(formData.get('treatment_text'))
    if (!rawText) return { success: false, error: 'Unos ne može biti prazan.' }

    // Belgrade-localized timestamp — dd.MM.yyyy. HH:mm format
    const belgradeTime = new Intl.DateTimeFormat('sr-Latn-RS', {
      timeZone: 'Europe/Belgrade',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date())

    const entry = `[${belgradeTime}] ${rawText}`

    const supabase = await createClient()

    // Single atomic SQL call — no separate fetch needed.
    const { data: appt, error } = await supabase
      .rpc('prepend_treatment_history', {
        p_appointment_id: appointmentId,
        p_entry: entry,
      })

    if (error) {
      // Fallback: if RPC doesn't exist yet, use the fetch→update approach
      const { data: existing, error: fetchErr } = await supabase
        .from('appointments')
        .select('treatment_history, patient_id')
        .eq('id', appointmentId)
        .single()

      if (fetchErr || !existing) {
        return { success: false, error: 'Termin nije pronađen.' }
      }

      const { error: updateErr } = await supabase
        .from('appointments')
        .update({ treatment_history: [entry, ...(existing.treatment_history ?? [])] })
        .eq('id', appointmentId)

      if (updateErr) {
        console.error('[logTreatment] Fallback Error:', updateErr.message)
        return { success: false, error: 'Greška pri unosu tretmana.' }
      }

      revalidatePath('/admin')
      revalidatePath(`/admin/patients/${existing.patient_id}`)
      return { success: true }
    }

    revalidatePath('/admin')
    if (appt) revalidatePath(`/admin/patients/${appt}`)
    return { success: true }
  } catch (err) {
    console.error('[logTreatment] Unexpected:', err)
    return { success: false, error: 'Došlo je do neočekivane greške na serveru.' }
  }
}

/**
 * Update the treatment_today field of an appointment.
 */
export async function updateTreatmentToday(
  appointmentId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const treatmentToday = sanitizeText(formData.get('treatment_today'))

    const supabase = await createClient()
    const { data: appt, error: fetchError } = await supabase
      .from('appointments')
      .select('patient_id')
      .eq('id', appointmentId)
      .single()

    if (fetchError) return { success: false, error: 'Termin nije pronađen.' }

    const { error } = await supabase
      .from('appointments')
      .update({ treatment_today: treatmentToday || null })
      .eq('id', appointmentId)

    if (error) {
      console.error('[updateTreatmentToday] DB Error:', error.message)
      return { success: false, error: 'Greška pri ažuriranju tretmana.' }
    }

    revalidatePath(`/admin/patients/${appt?.patient_id}`)
    return { success: true }
  } catch (err) {
    console.error('[updateTreatmentToday] Unexpected:', err)
    return { success: false, error: 'Došlo je do neočekivane greške na serveru.' }
  }
}

// ---------------------------------------------------------------------------
// V2.0 EXCEL IMPORT & CLINICAL DOSSIER
// ---------------------------------------------------------------------------

export interface ImportPatient {
  first_name?: string
  last_name?: string | null
  phone?: string
  email?: string | null
  parent_name?: string | null
  medical_alerts?: string | null
  notes?: string | null
  category?: string
  appointment_date?: string | null
  doctor_name?: string | null
}

/**
 * Bulk import patients from parsed Excel/CSV arrays.
 * Employs custom deduplication based on matching names for patients without phone numbers.
 * Safely handles phone conflicts by offloading colliding numbers into notes and generating no-phone IDs.
 * Also parses and inserts associated future appointments.
 */
export async function bulkImportPatients(patients: ImportPatient[]): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    
    // 1. Fetch existing patients to match potential candidates and check phone availability
    const { data: existing, error: fetchErr } = await supabase
      .from('patients')
      .select('first_name, last_name, phone')

    if (fetchErr) {
      console.error('[bulkImportPatients] Fetch existing failed:', fetchErr.message)
      return { success: false, error: 'Greška pri učitavanju baze pacijenata.' }
    }

    // Map existing no-phone patients by normalized name key -> generated phone number
    const existingNoPhoneMap = new Map<string, string>()
    // Map existing regular patients by phone number -> name
    const existingPhoneMap = new Map<string, { first_name: string; last_name: string | null }>()

    if (existing) {
      for (const p of existing) {
        if (p.phone.startsWith('/-no-phone-')) {
          const key = `${p.first_name.trim().toLowerCase()}${(p.last_name || '').trim().toLowerCase()}`.replace(/[\s\._-]/g, '')
          existingNoPhoneMap.set(key, p.phone)
        } else if (!p.phone.startsWith('/')) {
          existingPhoneMap.set(p.phone, { first_name: p.first_name, last_name: p.last_name })
        }
      }
    }

    // Keep track of phone numbers assigned within this import batch to avoid collisions inside the same statement
    const batchPhoneSet = new Set<string>()

    // Format patients to match schema
    const formattedPatients = patients.map(p => {
      let phoneVal = sanitizePhone(p.phone)
      const fName = sanitizeText(p.first_name) || 'Nepoznato'
      const lName = sanitizeText(p.last_name) || ''
      const nameKey = `${fName.trim().toLowerCase()}${lName.trim().toLowerCase()}`.replace(/[\s\._-]/g, '')
      
      let noteExtra = ''

      const isNoPhone = !phoneVal || phoneVal === '/' || phoneVal.startsWith('/')

      if (isNoPhone) {
        if (existingNoPhoneMap.has(nameKey)) {
          // Match existing no-phone record to prevent creating duplicates on re-import
          phoneVal = existingNoPhoneMap.get(nameKey)!
        } else {
          // Generate key and save to temp map to avoid dups within the same imported batch
          phoneVal = `/-no-phone-${Math.random().toString(36).substring(2, 10)}`
          existingNoPhoneMap.set(nameKey, phoneVal)
        }
      } else {
        // It has a phone number. Check if it collides with an existing patient of a different name,
        // or if it collides with a patient already processed in this batch.
        const existingOwner = existingPhoneMap.get(phoneVal)
        const isDuplicateInBatch = batchPhoneSet.has(phoneVal)

        if (
          (existingOwner && 
            (existingOwner.first_name.trim().toLowerCase() !== fName.trim().toLowerCase() || 
             (existingOwner.last_name || '').trim().toLowerCase() !== lName.trim().toLowerCase())) || 
          isDuplicateInBatch
        ) {
          // Collision: treat as no-phone, generate code, append original phone to notes
          noteExtra = `Uvezen broj telefona: ${phoneVal}`
          phoneVal = `/-no-phone-${Math.random().toString(36).substring(2, 10)}`
        } else {
          // Normal phone number: track to prevent duplicate updates in the same upsert
          batchPhoneSet.add(phoneVal)
        }
      }

      let notesVal = sanitizeText(p.notes) || null
      if (noteExtra) {
        notesVal = notesVal ? `${notesVal} | ${noteExtra}` : noteExtra
      }

      return {
        first_name: fName,
        last_name: lName || null,
        phone: phoneVal,
        email: sanitizeEmail(p.email) || null,
        parent_name: sanitizeText(p.parent_name) || null,
        medical_alerts: sanitizeText(p.medical_alerts) || null,
        notes: notesVal,
        category: p.category || 'regular',
      }
    })

    // Remove duplicates from formattedPatients by phone key (PostgreSQL upsert can fail if duplicate phone keys exist in the same array)
    const dedupedMap = new Map<string, typeof formattedPatients[0]>()
    formattedPatients.forEach(p => {
      dedupedMap.set(p.phone, p)
    })
    const finalPatients = Array.from(dedupedMap.values())

    // 2. Upsert patients and retrieve their DB ids
    const { data: upsertedPatients, error } = await supabase
      .from('patients')
      .upsert(finalPatients, {
        onConflict: 'phone',
        ignoreDuplicates: false,
      })
      .select('id, phone')

    if (error) {
      console.error('[bulkImportPatients] DB Error:', error.message)
      return { success: false, error: `Greška pri uvozu pacijenata u bazu: ${error.message}` }
    }

    // Map upserted patients phone -> ID
    const phoneToIdMap = new Map<string, string>()
    if (upsertedPatients) {
      for (const p of upsertedPatients) {
        phoneToIdMap.set(p.phone, p.id)
      }
    }

    // 3. Process and bulk insert appointments if present
    const appointmentsToInsert: any[] = []
    
    patients.forEach((p, idx) => {
      if (p.appointment_date) {
        const formattedPhone = formattedPatients[idx].phone
        const patientId = phoneToIdMap.get(formattedPhone)
        
        if (patientId) {
          const dt = parseBelgradeDateTime(p.appointment_date)
          if (!isNaN(dt.getTime())) {
            appointmentsToInsert.push({
              patient_id: patientId,
              appointment_datetime: dt.toISOString(),
              doctor_name: p.doctor_name || null,
              treatment_today: 'Uvezen termin',
              treatment_history: [],
              reminder_sent: false,
            })
          }
        }
      }
    })

    if (appointmentsToInsert.length > 0) {
      // Fetch existing appointments for relevant patients to avoid duplicates
      const patientIds = Array.from(new Set(appointmentsToInsert.map(a => a.patient_id)))
      const { data: existingAppts } = await supabase
        .from('appointments')
        .select('patient_id, appointment_datetime')
        .in('patient_id', patientIds)

      const existingSet = new Set<string>()
      if (existingAppts) {
        for (const ea of existingAppts) {
          existingSet.add(`${ea.patient_id}_${new Date(ea.appointment_datetime).toISOString()}`)
        }
      }

      // Filter out duplicate appointments
      const filteredAppts = appointmentsToInsert.filter(a => {
        const key = `${a.patient_id}_${new Date(a.appointment_datetime).toISOString()}`
        return !existingSet.has(key)
      })

      if (filteredAppts.length > 0) {
        const { error: apptsErr } = await supabase
          .from('appointments')
          .insert(filteredAppts)
        
        if (apptsErr) {
          console.error('[bulkImportPatients] Appointments Insertion Error:', apptsErr.message)
        }
      }
    }

    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    console.error('[bulkImportPatients] Unexpected:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Neočekivana greška pri uvozu: ${msg}` }
  }
}

/**
 * Add a clinical dossier report.
 */
export async function addClinicalReport(
  patientId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const anamneza = sanitizeText(formData.get('anamneza'))
    const nalaz = sanitizeText(formData.get('nalaz'))
    const terapija = sanitizeText(formData.get('terapija'))
    const savet = sanitizeText(formData.get('savet'))
    const doctorName = sanitizeText(formData.get('doctor_name')) || null
    const futurePlan = sanitizeText(formData.get('future_treatment_plan')) || null
    
    let servicesProvided: string[] = []
    try {
      const raw = String(formData.get('services_provided') ?? '[]')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        servicesProvided = parsed.filter(s => typeof s === 'string')
      }
    } catch { servicesProvided = [] }

    if (!anamneza && !nalaz && !terapija && !savet && servicesProvided.length === 0) {
      return { success: false, error: 'Morate popuniti barem jedno polje izveštaja.' }
    }

    const supabase = await createClient()
    const { error } = await supabase.from('clinical_reports').insert({
      patient_id: patientId,
      anamneza: anamneza || null,
      nalaz: nalaz || null,
      terapija: terapija || null,
      savet: savet || null,
      doctor_name: doctorName,
      services_provided: servicesProvided,
      future_treatment_plan: futurePlan,
    })

    if (error) {
      console.error('[addClinicalReport] DB Error:', error.message)
      return { success: false, error: 'Greška pri dodavanju izveštaja.' }
    }

    revalidatePath(`/admin/patients/${patientId}`)
    return { success: true }
  } catch (err) {
    console.error('[addClinicalReport] Unexpected:', err)
    return { success: false, error: 'Došlo je do neočekivane greške na serveru.' }
  }
}

// ---------------------------------------------------------------------------
// STORAGE ACTIONS (Bypass RLS using Service Role Key)
// ---------------------------------------------------------------------------

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function uploadXRay(formData: FormData): Promise<{ success: boolean; file?: any; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Neautorizovan pristup.' }
    }

    const file = formData.get('file') as File
    const patientId = formData.get('patientId') as string
    if (!file || !patientId) {
      return { success: false, error: 'Nedostaje fajl ili ID pacijenta.' }
    }

    const adminClient = createAdminClient()
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `patients/${patientId}/${timestamp}_${safeName}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await adminClient.storage
      .from('xrays')
      .upload(path, buffer, {
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    const { data: signedData, error: signError } = await adminClient.storage
      .from('xrays')
      .createSignedUrl(path, 3600) // 1 hour expiration

    if (signError) {
      return { success: false, error: signError.message }
    }

    return {
      success: true,
      file: {
        name: file.name,
        url: signedData.signedUrl,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        path,
      }
    }
  } catch (err: any) {
    console.error('[uploadXRay] error:', err)
    return { success: false, error: err.message || 'Greška pri uploadu.' }
  }
}

export async function listXRays(patientId: string): Promise<{ success: boolean; files?: any[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Neautorizovan pristup.' }
    }

    if (!patientId) {
      return { success: false, error: 'Nedostaje ID pacijenta.' }
    }

    const adminClient = createAdminClient()
    const { data, error } = await adminClient.storage
      .from('xrays')
      .list(`patients/${patientId}`, { sortBy: { column: 'created_at', order: 'desc' } })

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data || data.length === 0) {
      return { success: true, files: [] }
    }

    const filteredFiles = data.filter(f => f.name !== '.emptyFolderPlaceholder')
    if (filteredFiles.length === 0) {
      return { success: true, files: [] }
    }

    const paths = filteredFiles.map(f => `patients/${patientId}/${f.name}`)
    const { data: signedUrls, error: signError } = await adminClient.storage
      .from('xrays')
      .createSignedUrls(paths, 3600) // 1 hour expiration

    if (signError) {
      return { success: false, error: signError.message }
    }

    const files = filteredFiles.map(f => {
      const path = `patients/${patientId}/${f.name}`
      const signedObj = signedUrls.find(s => s.path === path)
      return {
        name: f.name,
        url: signedObj ? signedObj.signedUrl : '',
        type: f.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        uploadedAt: f.created_at ?? new Date().toISOString(),
        path,
      }
    })

    return { success: true, files }
  } catch (err: any) {
    console.error('[listXRays] error:', err)
    return { success: false, error: err.message || 'Greška pri listanju snimaka.' }
  }
}

export async function deleteXRay(path: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Neautorizovan pristup.' }
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient.storage.from('xrays').remove([path])
    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    console.error('[deleteXRay] error:', err)
    return { success: false, error: err.message || 'Greška pri brisanju.' }
  }
}

/**
 * Delete an appointment.
 */
export async function deleteAppointment(appointmentId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    
    // First, find the patient ID of the appointment to revalidate their page
    const { data: appt, error: findError } = await supabase
      .from('appointments')
      .select('patient_id')
      .eq('id', appointmentId)
      .single()

    if (findError || !appt) {
      return { success: false, error: 'Termin nije pronađen.' }
    }

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', appointmentId)

    if (error) {
      console.error('[deleteAppointment] DB Error:', error.message)
      return { success: false, error: 'Greška pri brisanju termina.' }
    }

    revalidatePath('/admin')
    revalidatePath(`/admin/patients/${appt.patient_id}`)
    return { success: true }
  } catch (err) {
    console.error('[deleteAppointment] Unexpected:', err)
    return { success: false, error: 'Došlo je do neočekivane greške na serveru.' }
  }
}

/**
 * Update an appointment date/time and doctor.
 */
export async function updateAppointment(
  appointmentId: string,
  datetimeRaw: string,
  doctorName: string | null,
  treatmentToday?: string | null
): Promise<ActionResult> {
  try {
    if (!datetimeRaw) return { success: false, error: 'Datum i vreme su obavezni.' }

    const dt = parseBelgradeDateTime(datetimeRaw)
    if (isNaN(dt.getTime())) {
      return { success: false, error: 'Neispravan datum ili vreme.' }
    }

    const supabase = await createClient()

    // Find patient ID for revalidation
    const { data: appt, error: findError } = await supabase
      .from('appointments')
      .select('patient_id')
      .eq('id', appointmentId)
      .single()

    if (findError || !appt) {
      return { success: false, error: 'Termin nije pronađen.' }
    }

    const { error } = await supabase
      .from('appointments')
      .update({
        appointment_datetime: dt.toISOString(),
        doctor_name: doctorName || null,
        treatment_today: treatmentToday || null,
      })
      .eq('id', appointmentId)

    if (error) {
      console.error('[updateAppointment] DB Error:', error.message)
      return { success: false, error: 'Greška pri izmeni termina.' }
    }

    revalidatePath('/admin')
    revalidatePath(`/admin/patients/${appt.patient_id}`)
    return { success: true }
  } catch (err) {
    console.error('[updateAppointment] Unexpected:', err)
    return { success: false, error: 'Došlo je do neočekivane greške na serveru.' }
  }
}

