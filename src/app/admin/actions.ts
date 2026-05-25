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
    const { error } = await supabase.from('patients').insert({
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
    })

    if (error) {
      console.error('[addPatient] DB Error:', error.message)
      if (error.message.includes('unique') || error.code === '23505') {
        return { success: false, error: 'Pacijent sa ovim telefonom već postoji.' }
      }
      return { success: false, error: 'Greška pri dodavanju pacijenta.' }
    }

    revalidatePath('/admin')
    return { success: true }
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
export async function deletePatient(patientId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('patients')
      .delete()
      .eq('id', patientId)

    if (error) {
      console.error('[deletePatient] DB Error:', error.message)
    }
  } catch (err) {
    console.error('[deletePatient] Unexpected:', err)
  }

  revalidatePath('/admin')
  redirect('/admin')
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

    if (!patientId) return { success: false, error: 'Pacijent je obavezan.' }
    if (!datetimeRaw) return { success: false, error: 'Datum i vreme su obavezni.' }

    const dt = parseBelgradeDateTime(datetimeRaw)
    if (isNaN(dt.getTime())) {
      return { success: false, error: 'Neispravan datum ili vreme.' }
    }

    const supabase = await createClient()
    const { error } = await supabase.from('appointments').insert({
      patient_id: patientId,
      appointment_datetime: dt.toISOString(),
      treatment_today: treatmentToday || null,
      treatment_history: [],
      reminder_sent: false,
    })

    if (error) {
      console.error('[addAppointment] DB Error:', error.message)
      return { success: false, error: 'Greška pri dodavanju termina.' }
    }

    revalidatePath('/admin')
    revalidatePath(`/admin/patients/${patientId}`)
    return { success: true }
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
}

/**
 * Bulk import patients from parsed Excel/CSV arrays.
 * Employs custom deduplication based on matching names for patients without phone numbers.
 */
export async function bulkImportPatients(patients: ImportPatient[]): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    
    // 1. Fetch existing patients to match potential no-phone candidates
    const { data: existing, error: fetchErr } = await supabase
      .from('patients')
      .select('first_name, last_name, phone')

    if (fetchErr) {
      console.error('[bulkImportPatients] Fetch existing failed:', fetchErr.message)
      return { success: false, error: 'Greška pri učitavanju baze pacijenata.' }
    }

    // Map existing no-phone patients by normalized name key
    const existingNoPhoneMap = new Map<string, string>()
    if (existing) {
      for (const p of existing) {
        if (p.phone.startsWith('/-no-phone-')) {
          const key = `${p.first_name.trim().toLowerCase()}_${(p.last_name || '').trim().toLowerCase()}`
          existingNoPhoneMap.set(key, p.phone)
        }
      }
    }

    // Format patients to match schema
    const formattedPatients = patients.map(p => {
      let phoneVal = sanitizePhone(p.phone)
      
      if (!phoneVal || phoneVal === '/' || phoneVal.startsWith('/')) {
        const fName = sanitizeText(p.first_name) || 'Nepoznato'
        const lName = sanitizeText(p.last_name) || ''
        const key = `${fName.trim().toLowerCase()}_${lName.trim().toLowerCase()}`

        if (existingNoPhoneMap.has(key)) {
          // Match existing no-phone record to prevent creating duplicates on re-import
          phoneVal = existingNoPhoneMap.get(key)!
        } else {
          // Generate key and save to temp map to avoid dups within the same imported batch
          phoneVal = `/-no-phone-${Math.random().toString(36).substring(2, 10)}`
          existingNoPhoneMap.set(key, phoneVal)
        }
      }

      return {
        first_name: sanitizeText(p.first_name) || 'Nepoznato',
        last_name: sanitizeText(p.last_name) || null,
        phone: phoneVal,
        email: sanitizeEmail(p.email) || null,
        parent_name: sanitizeText(p.parent_name) || null,
        medical_alerts: sanitizeText(p.medical_alerts) || null,
        notes: sanitizeText(p.notes) || null,
        category: p.category || 'regular',
      }
    })

    const { error } = await supabase.from('patients').upsert(formattedPatients, {
      onConflict: 'phone',
      ignoreDuplicates: false,
    })

    if (error) {
      console.error('[bulkImportPatients] DB Error:', error.message)
      return { success: false, error: 'Greška pri uvozu pacijenata. Proverite format.' }
    }

    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    console.error('[bulkImportPatients] Unexpected:', err)
    return { success: false, error: 'Došlo je do neočekivane greške pri uvozu.' }
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

    const { data: urlData } = adminClient.storage.from('xrays').getPublicUrl(path)

    return {
      success: true,
      file: {
        name: file.name,
        url: urlData.publicUrl,
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

