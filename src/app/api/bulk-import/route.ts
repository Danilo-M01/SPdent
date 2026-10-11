export const maxDuration = 60
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  sanitizeText,
  sanitizePhone,
  sanitizeEmail,
} from '@/lib/sanitize'

// ---------------------------------------------------------------------------
// POST /api/bulk-import
// Accepts a JSON body: { patients: ImportPatient[], existingPhones?: string[] }
// Returns: { success, inserted, skipped, errors }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const bypassKey = request.headers.get('x-bypass-auth')
    const isLocalDev = process.env.NODE_ENV === 'development'
    const isBypassed = isLocalDev && bypassKey === 'bulk-import-bypass-secret'

    let supabase
    if (isBypassed) {
      // Use service role key to bypass RLS for development testing
      const { createClient: createDirectClient } = await import('@supabase/supabase-js')
      supabase = createDirectClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
    } else {
      supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Neautorizovan pristup.' },
          { status: 401 }
        )
      }
    }

    const body = await request.json()
    const patients: any[] = body.patients || []

    if (patients.length === 0) {
      return NextResponse.json({ success: true, inserted: 0, skipped: 0, errors: [] })
    }

    // 2. Format patients for DB
    const formattedPatients = patients.map((p: any) => {
      let phoneVal = sanitizePhone(p.phone)
      const fName = sanitizeText(p.first_name) || 'Nepoznato'

      // Generate unique no-phone ID if missing
      if (!phoneVal || phoneVal === '/' || phoneVal.startsWith('/')) {
        // Use client-provided generated phone if available
        if (p._generatedPhone) {
          phoneVal = p._generatedPhone
        } else {
          phoneVal = `/-no-phone-${Math.random().toString(36).substring(2, 10)}`
        }
      }

      const validCategories = ['regular', 'implant', 'proteza']

      return {
        first_name: fName,
        last_name: sanitizeText(p.last_name) || null,
        phone: phoneVal,
        email: sanitizeEmail(p.email) || null,
        parent_name: sanitizeText(p.parent_name) || null,
        medical_alerts: sanitizeText(p.medical_alerts) || null,
        notes: sanitizeText(p.notes) || null,
        category: validCategories.includes(p.category) ? p.category : 'regular',
        chart_number: sanitizeText(p.chart_number) || null,
      }
    })

    // 3. Deduplicate within this chunk by phone (only for patients WITH a real phone).
    //    Patients without a phone are NEVER deduped — different people CAN share a name.
    const dedupMap = new Map<string, typeof formattedPatients[0]>()
    const finalPatients: typeof formattedPatients = []
    formattedPatients.forEach(p => {
      const hasRealPhone = p.phone && p.phone !== '/' && !p.phone.startsWith('/-no-phone-')
      if (hasRealPhone) {
        if (!dedupMap.has(p.phone)) {
          dedupMap.set(p.phone, p)
          finalPatients.push(p)
        }
      } else {
        // No phone — always keep
        finalPatients.push(p)
      }
    })

    // 4. Smart merge upsert — fetch existing patients first to avoid overwriting non-null fields with null
    // This ensures chart_number, email, notes etc. are preserved if the new import row doesn't have them
    const SUB_BATCH = 100
    let insertedCount = 0
    const errors: string[] = []

    // Fetch existing patients by phone to enable smart merge
    const realPhones = finalPatients
      .filter(p => p.phone && !p.phone.startsWith('/-no-phone-') && p.phone !== '/')
      .map(p => p.phone)

    const existingByPhone = new Map<string, any>()
    if (realPhones.length > 0) {
      for (let i = 0; i < realPhones.length; i += SUB_BATCH) {
        const phoneBatch = realPhones.slice(i, i + SUB_BATCH)
        const { data: existing } = await supabase
          .from('patients')
          .select('id, phone, chart_number, email, notes, parent_name, medical_alerts, category')
          .in('phone', phoneBatch)
        if (existing) {
          existing.forEach((p: any) => existingByPhone.set(p.phone, p))
        }
      }
    }

    // Also fetch existing patients by chart_number if present
    const chartNumbers = finalPatients
      .map(p => p.chart_number)
      .filter((cn): cn is string => Boolean(cn))

    const existingByChart = new Map<string, any>()
    if (chartNumbers.length > 0) {
      for (let i = 0; i < chartNumbers.length; i += SUB_BATCH) {
        const chartBatch = chartNumbers.slice(i, i + SUB_BATCH)
        const { data: existing } = await supabase
          .from('patients')
          .select('id, phone, chart_number, email, notes, parent_name, medical_alerts, category')
          .in('chart_number', chartBatch)
        if (existing) {
          existing.forEach((p: any) => {
            if (p.chart_number) existingByChart.set(p.chart_number.toLowerCase().trim(), p)
          })
        }
      }
    }

    // Merge: for each patient, if existing (by phone or chart_number), update with new non-null fields
    const mergedPatients = finalPatients.map(p => {
      let existing = existingByPhone.get(p.phone)
      if (!existing && p.chart_number) {
        existing = existingByChart.get(p.chart_number.toLowerCase().trim())
      }
      if (!existing) return p // New patient — insert as-is

      // If matched by chart_number and new row has no phone, keep existing phone for onConflict upsert
      const phoneToUse = (p.phone && !p.phone.startsWith('/-no-phone-') && p.phone !== '/')
        ? p.phone
        : existing.phone

      // Merge: keep existing values for fields that are null in the import
      return {
        ...p,
        phone: phoneToUse,
        chart_number: p.chart_number ?? existing.chart_number,
        email: p.email ?? existing.email,
        notes: p.notes
          ? (existing.notes && !existing.notes.includes(p.notes) ? `${p.notes} | ${existing.notes}` : (existing.notes || p.notes))
          : existing.notes,
        parent_name: p.parent_name ?? existing.parent_name,
        medical_alerts: p.medical_alerts ?? existing.medical_alerts,
        // Only override category if the import has a non-default value
        category: (p.category && p.category !== 'regular') ? p.category : (existing.category || p.category),
      }
    })

    for (let i = 0; i < mergedPatients.length; i += SUB_BATCH) {
      const batch = mergedPatients.slice(i, i + SUB_BATCH)
      const { data, error } = await supabase
        .from('patients')
        .upsert(batch, {
          onConflict: 'phone',
          ignoreDuplicates: false,
        })
        .select('id')

      if (error) {
        console.error(`[bulk-import] Batch error at offset ${i}:`, error.message)
        errors.push(`Greška u batchu ${Math.floor(i / SUB_BATCH) + 1}: ${error.message}`)
      } else {
        insertedCount += data?.length ?? batch.length
      }
    }

    // 5. Handle appointments if present — reuse existingByPhone map to avoid extra DB round-trips
    let appointmentsInserted = 0
    const patientsWithAppointments = patients.filter((p: any) => p.appointment_date)

    if (patientsWithAppointments.length > 0) {
      // Build phone→id map: start from already-fetched existing patients
      const phoneToId = new Map<string, string>()
      existingByPhone.forEach((existing: any) => {
        if (existing.id) phoneToId.set(existing.phone, existing.id)
      })

      // For phones not yet in the map (newly inserted patients), do ONE fetch
      const missingPhones = patientsWithAppointments
        .map((p: any) => {
          const phone = sanitizePhone(p.phone) || p._generatedPhone || ''
          return phone
        })
        .filter((phone: string) => phone && !phoneToId.has(phone))

      if (missingPhones.length > 0) {
        for (let i = 0; i < missingPhones.length; i += SUB_BATCH) {
          const phoneBatch = missingPhones.slice(i, i + SUB_BATCH)
          const { data: foundPatients } = await supabase
            .from('patients')
            .select('id, phone')
            .in('phone', phoneBatch)
          if (foundPatients) {
            foundPatients.forEach((fp: any) => phoneToId.set(fp.phone, fp.id))
          }
        }
      }

      // Build appointment records
      const appointmentsToInsert: any[] = []
      patientsWithAppointments.forEach((p: any) => {
        const phone = sanitizePhone(p.phone) || p._generatedPhone || ''
        const patientId = phoneToId.get(phone)
        if (patientId && p.appointment_date) {
          appointmentsToInsert.push({
            patient_id: patientId,
            appointment_datetime: p.appointment_date,
            doctor_name: p.doctor_name || null,
            treatment_today: 'Uvezen termin',
            treatment_history: [],
            reminder_sent: false,
          })
        }
      })

      // Insert appointments in batches
      for (let i = 0; i < appointmentsToInsert.length; i += SUB_BATCH) {
        const batch = appointmentsToInsert.slice(i, i + SUB_BATCH)
        const { error: apptErr } = await supabase
          .from('appointments')
          .insert(batch)

        if (apptErr) {
          console.error(`[bulk-import] Appointment batch error:`, apptErr.message)
        } else {
          appointmentsInserted += batch.length
        }
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      inserted: insertedCount,
      skipped: finalPatients.length - insertedCount,
      appointmentsInserted,
      errors,
    })
  } catch (err) {
    console.error('[bulk-import] Unexpected:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, error: `Neočekivana greška: ${msg}` },
      { status: 500 }
    )
  }
}
