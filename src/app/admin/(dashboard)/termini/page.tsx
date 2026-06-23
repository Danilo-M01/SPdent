import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TerminiClient from '@/components/admin/TerminiClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'SP DENT — Termini',
}

interface Patient {
  id: string
  first_name: string
  last_name: string | null
  phone: string
  category: string
}

interface Appointment {
  id: string
  appointment_datetime: string
  doctor_name: string | null
  treatment_today: string | null
  reminder_sent: boolean
  patient: Patient
}

// Default patient placeholder for appointments with missing/invalid patient data
const UNKNOWN_PATIENT: Patient = {
  id: 'unknown',
  first_name: 'Nepoznat',
  last_name: 'pacijent',
  phone: '/',
  category: 'regular',
}

export default async function TerminiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  // Load appointments from 90 days ago onwards to support viewing past/present/future weeks & months
  const startRange = new Date()
  startRange.setDate(startRange.getDate() - 90)

  // ── Run parallel queries for appointments and patients in PARALLEL ──────
  const [rawAppointments, rawPatients] = await Promise.all([
    fetchAllParallel<any>(
      supabase,
      'appointments',
      `
        id,
        appointment_datetime,
        doctor_name,
        treatment_today,
        reminder_sent,
        patient:patient_id (
          id,
          first_name,
          last_name,
          phone,
          category
        )
      `,
      (q) => q.gte('appointment_datetime', startRange.toISOString()).order('appointment_datetime', { ascending: true })
    ),
    fetchAllParallel<any>(
      supabase,
      'patients',
      'id, first_name, last_name, phone, category',
      (q) => q.order('first_name', { ascending: true })
    ),
  ])

  // Normalize: Supabase join can return null, an array, or an object for `patient`.
  // Ensure every appointment has a valid `patient` object to prevent client-side crashes.
  const appointments: Appointment[] = (rawAppointments || []).map((raw: Record<string, unknown>) => {
    let patient: Patient = UNKNOWN_PATIENT
    
    if (raw.patient) {
      // Supabase sometimes returns an array for joins — take the first element
      const p = Array.isArray(raw.patient) ? raw.patient[0] : raw.patient
      if (p && typeof p === 'object' && 'id' in p) {
        patient = {
          id: String((p as Record<string, unknown>).id || 'unknown'),
          first_name: String((p as Record<string, unknown>).first_name || 'Nepoznat'),
          last_name: (p as Record<string, unknown>).last_name ? String((p as Record<string, unknown>).last_name) : null,
          phone: String((p as Record<string, unknown>).phone || '/'),
          category: String((p as Record<string, unknown>).category || 'regular'),
        }
      }
    }
    
    return {
      id: String(raw.id),
      appointment_datetime: String(raw.appointment_datetime),
      doctor_name: raw.doctor_name ? String(raw.doctor_name) : null,
      treatment_today: raw.treatment_today ? String(raw.treatment_today) : null,
      reminder_sent: Boolean(raw.reminder_sent),
      patient,
    }
  })

  return (
    <TerminiClient
      initialAppointments={appointments}
      patients={(rawPatients as unknown as Patient[]) || []}
    />
  )
}

const PAGE_LIMIT = 1000

/** Parallel paginated fetch — counts total rows first, then queries pages in parallel. */
async function fetchAllParallel<T>(
  supabase: any,
  tableName: string,
  selectColumns: string,
  optionsFn?: (query: any) => any
): Promise<T[]> {
  let countQuery = supabase
    .from(tableName)
    .select('id', { count: 'exact', head: true })

  if (optionsFn) {
    countQuery = optionsFn(countQuery)
  }

  const { count, error: countError } = await countQuery
  if (countError) {
    console.error(`[fetchAllParallel] Count error for ${tableName}:`, countError.message)
    return []
  }

  const total = count ?? 0
  if (total === 0) return []

  const promises: Promise<{ data: T[] | null; error: any }>[] = []

  for (let offset = 0; offset < total; offset += PAGE_LIMIT) {
    let query = supabase
      .from(tableName)
      .select(selectColumns)
      .range(offset, offset + PAGE_LIMIT - 1)

    if (optionsFn) {
      query = optionsFn(query)
    }

    promises.push(query)
  }

  const results = await Promise.all(promises)
  const allData: T[] = []
  for (const res of results) {
    if (res.error) {
      console.error(`[fetchAllParallel] Fetch error for ${tableName}:`, res.error.message)
      continue
    }
    if (res.data) {
      allData.push(...res.data)
    }
  }
  return allData
}


