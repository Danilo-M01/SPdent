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
// Deterministic key generator for patients without phone numbers.
// Ensures that re-importing the same Excel file NEVER creates duplicates!
// ---------------------------------------------------------------------------
function generateDeterministicNoPhone(
  firstName: string,
  lastName?: string | null,
  chartNumber?: string | null,
  parentName?: string | null
): string {
  const base = `${firstName} ${lastName ?? ''} ${chartNumber ?? ''} ${parentName ?? ''}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')
  let hash = 0
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i)
    hash |= 0
  }
  const hex = Math.abs(hash).toString(36)
  const slug = base.substring(0, 10) || 'anon'
  return `/-no-phone-${slug}-${hex}`
}

function mergeNotes(newNotes?: string | null, existingNotes?: string | null): string | null {
  const n = (newNotes || '').trim()
  const e = (existingNotes || '').trim()
  if (!n) return e || null
  if (!e) return n || null
  if (e.includes(n)) return e
  if (n.includes(e)) return n
  return `${n} | ${e}`
}

// ---------------------------------------------------------------------------
// POST /api/bulk-import
// Accepts a JSON body: { patients: ImportPatient[] }
// Returns: { success, inserted, updated, skipped, appointmentsInserted, errors }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Neautorizovan pristup.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const patients: any[] = body.patients || []

    if (patients.length === 0) {
      return NextResponse.json({ success: true, inserted: 0, updated: 0, skipped: 0, appointmentsInserted: 0, errors: [] })
    }

    const SUB_BATCH = 50
    let insertedCount = 0
    let updatedCount = 0
    const errors: string[] = []

    // 2. Format & normalize all patients with deterministic identifiers
    const formattedPatients = patients.map((p: any) => {
      const fName = sanitizeText(p.first_name) || 'Nepoznato'
      const lName = sanitizeText(p.last_name) || null
      const rawChart = sanitizeText(p.chart_number)
      const chartNum = rawChart ? rawChart.trim() : null
      const parent = sanitizeText(p.parent_name) || null

      let phoneVal = sanitizePhone(p.phone)
      const hasRealPhone = phoneVal && phoneVal !== '/' && !phoneVal.startsWith('/')

      if (!hasRealPhone) {
        phoneVal = generateDeterministicNoPhone(fName, lName, chartNum, parent)
      }

      const validCategories = ['regular', 'implant', 'proteza']

      return {
        first_name: fName,
        last_name: lName,
        phone: phoneVal,
        hasRealPhone,
        email: sanitizeEmail(p.email) || null,
        parent_name: parent,
        medical_alerts: sanitizeText(p.medical_alerts) || null,
        notes: sanitizeText(p.notes) || null,
        category: validCategories.includes(p.category) ? p.category : 'regular',
        chart_number: chartNum,
        appointment_date: p.appointment_date || null,
        doctor_name: sanitizeText(p.doctor_name) || null,
      }
    })

    // 3. Deduplicate ONLY within same chart_number in this batch.
    //    Patients WITHOUT chart_number are ALWAYS inserted as new — never merged by name or phone.
    const dedupMap = new Map<string, typeof formattedPatients[0]>()
    const uniquePatients: typeof formattedPatients = []

    for (const p of formattedPatients) {
      if (p.chart_number) {
        // Only dedup if they share the exact same chart_number in this batch
        const key = p.chart_number.toLowerCase().trim()
        if (dedupMap.has(key)) {
          const prev = dedupMap.get(key)!
          prev.notes = mergeNotes(p.notes, prev.notes)
          if (!prev.email && p.email) prev.email = p.email
          if (!prev.parent_name && p.parent_name) prev.parent_name = p.parent_name
          if (!prev.medical_alerts && p.medical_alerts) prev.medical_alerts = p.medical_alerts
          if (p.category !== 'regular') prev.category = p.category
          if (!prev.appointment_date && p.appointment_date) {
            prev.appointment_date = p.appointment_date
            prev.doctor_name = p.doctor_name
          }
          continue
        }
        dedupMap.set(key, p)
      }
      uniquePatients.push(p)
    }

    // 4. Batch lookup existing patients by chart_number ONLY
    const chartsToLookup = Array.from(
      new Set(
        uniquePatients
          .filter(p => Boolean(p.chart_number))
          .map(p => p.chart_number!.trim())
      )
    )

    const existingByChart = new Map<string, any>()

    // Lookup by chart_number (batches of 100)
    for (let i = 0; i < chartsToLookup.length; i += 100) {
      const batch = chartsToLookup.slice(i, i + 100)
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, phone, email, parent_name, medical_alerts, notes, category, chart_number')
        .in('chart_number', batch)

      if (error) {
        console.error('[bulk-import] Error looking up charts:', error.message)
      } else if (data) {
        data.forEach((p: any) => {
          if (p.chart_number) {
            existingByChart.set(p.chart_number.toLowerCase().trim(), p)
          }
        })
      }
    }

    // 5. Upsert / Insert loop
    //    - Has chart_number AND exists in DB → UPDATE
    //    - Has chart_number AND not in DB → INSERT
    //    - No chart_number → always INSERT (multiple patients with same name are allowed)
    const phoneToId = new Map<string, string>()
    const chartToId = new Map<string, string>()

    for (let i = 0; i < uniquePatients.length; i += SUB_BATCH) {
      const batch = uniquePatients.slice(i, i + SUB_BATCH)

      for (const p of batch) {
        const chartKey = p.chart_number ? p.chart_number.toLowerCase().trim() : null
        const existing = chartKey ? existingByChart.get(chartKey) : undefined

        if (existing) {
          // --- UPDATE EXISTING RECORD (matched by chart_number only) ---
          const phoneToKeep = p.hasRealPhone
            ? p.phone
            : (existing.phone && !existing.phone.startsWith('/-no-phone-') ? existing.phone : p.phone)

          const updatePayload: Record<string, any> = {
            first_name: p.first_name || existing.first_name,
            last_name: p.last_name ?? existing.last_name,
            phone: phoneToKeep,
            chart_number: p.chart_number ?? existing.chart_number,
            email: p.email ?? existing.email,
            parent_name: p.parent_name ?? existing.parent_name,
            medical_alerts: p.medical_alerts ?? existing.medical_alerts,
            notes: mergeNotes(p.notes, existing.notes),
            category: (p.category && p.category !== 'regular') ? p.category : (existing.category || p.category),
            updated_at: new Date().toISOString(),
          }

          const { error: updateErr } = await supabase
            .from('patients')
            .update(updatePayload)
            .eq('id', existing.id)

          if (updateErr) {
            console.error(`[bulk-import] Update error for ${p.first_name}:`, updateErr.message)
            errors.push(`Greška pri ažuriranju (${p.first_name}): ${updateErr.message}`)
          } else {
            updatedCount++
            phoneToId.set(p.phone, existing.id)
            if (p.chart_number) chartToId.set(chartKey!, existing.id)
          }
        } else {
          // --- INSERT NEW RECORD ---
          // Patients without chart_number always get inserted fresh (no name/phone dedup)
          const insertPayload = {
            first_name: p.first_name,
            last_name: p.last_name,
            phone: p.phone,
            email: p.email,
            parent_name: p.parent_name,
            medical_alerts: p.medical_alerts,
            notes: p.notes,
            category: p.category,
            chart_number: p.chart_number,
          }

          const { data: newRow, error: insertErr } = await supabase
            .from('patients')
            .insert(insertPayload)
            .select('id, phone, chart_number')
            .single()

          if (insertErr) {
            // Phone unique constraint hit — update phone to a unique dummy and retry
            if (insertErr.code === '23505') {
              const dummyPhone = generateDeterministicNoPhone(
                p.first_name,
                p.last_name,
                p.chart_number,
                p.parent_name
              ) + `-${Date.now()}`
              const retryPayload = { ...insertPayload, phone: dummyPhone }
              const { data: retryRow, error: retryErr } = await supabase
                .from('patients')
                .insert(retryPayload)
                .select('id, phone, chart_number')
                .single()
              if (retryErr) {
                errors.push(`Greška pri unosu (${p.first_name}): ${retryErr.message}`)
              } else if (retryRow) {
                insertedCount++
                phoneToId.set(p.phone, retryRow.id)
                if (chartKey) chartToId.set(chartKey, retryRow.id)
                if (chartKey) existingByChart.set(chartKey, retryRow)
              }
            } else {
              console.error(`[bulk-import] Insert error for ${p.first_name}:`, insertErr.message)
              errors.push(`Greška pri unosu (${p.first_name}): ${insertErr.message}`)
            }
          } else if (newRow) {
            insertedCount++
            phoneToId.set(p.phone, newRow.id)
            if (chartKey) chartToId.set(chartKey, newRow.id)
            if (chartKey) existingByChart.set(chartKey, newRow)
          }
        }
      }
    }


    // 6. Handle appointments if present
    let appointmentsInserted = 0
    const patientsWithAppointments = uniquePatients.filter(p => p.appointment_date)

    if (patientsWithAppointments.length > 0) {
      const appointmentsToInsert: any[] = []

      for (const p of patientsWithAppointments) {
        let patientId = phoneToId.get(p.phone)
        if (!patientId && p.chart_number) {
          patientId = chartToId.get(p.chart_number.toLowerCase().trim())
        }

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
      }

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
      updated: updatedCount,
      skipped: 0,
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
