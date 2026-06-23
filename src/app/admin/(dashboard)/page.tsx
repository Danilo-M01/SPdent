import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboardClient from '@/components/admin/AdminDashboardClient'

export const dynamic = 'force-dynamic'

export interface Patient {
  id: string
  first_name: string
  last_name: string | null
  phone: string
  email: string | null
  parent_name: string | null
  medical_alerts: string | null
  notes: string | null
  category: string
  created_at: string
  updated_at: string
  // Sistematska anamneza
  has_hypertension: boolean
  has_diabetes: boolean
  takes_anticoagulants: boolean
  penicillin_allergy: boolean
  consent_signed: boolean
  // Computed / joined
  next_appointment?: string | null
  next_appointment_doctor?: string | null
  latest_report_at?: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PAGE_LIMIT = 1000

/** Parallel paginated fetch — counts total rows first, then queries pages in parallel. */
async function fetchAllParallel<T>(
  supabase: any,
  tableName: string,
  selectColumns: string,
  optionsFn?: (query: any) => any
): Promise<T[]> {
  // Count first (uses indexing on primary key)
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

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { category } = await searchParams

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // ── Run all independent queries (including parallel ranges) in PARALLEL ──
  const [patients, upcomingAppts, clinicalReports, todayCountResult] = await Promise.all([
    // 1. Patients (paginated parallel, excluding notes)
    fetchAllParallel<Patient>(
      supabase,
      'patients',
      'id, first_name, last_name, phone, email, parent_name, medical_alerts, category, created_at, has_hypertension, has_diabetes, takes_anticoagulants, penicillin_allergy, consent_signed',
      (q) => {
        let query = q.order('created_at', { ascending: false })
        if (category && ['regular', 'implant', 'proteza'].includes(category)) {
          query = query.eq('category', category)
        }
        return query
      }
    ),

    // 2. Upcoming appointments (paginated parallel)
    fetchAllParallel<{ patient_id: string; appointment_datetime: string; doctor_name: string | null }>(
      supabase,
      'appointments',
      'patient_id, appointment_datetime, doctor_name',
      (q) => q.gte('appointment_datetime', today.toISOString()).order('appointment_datetime', { ascending: true })
    ),

    // 3. Clinical reports (paginated parallel, only patient_id + created_at)
    fetchAllParallel<{ patient_id: string; created_at: string }>(
      supabase,
      'clinical_reports',
      'patient_id, created_at',
      (q) => q.order('created_at', { ascending: false })
    ),

    // 4. Today's appointment count
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .gte('appointment_datetime', today.toISOString())
      .lt('appointment_datetime', tomorrow.toISOString()),
  ])

  // ── Stats ────────────────────────────────────────────────────────────
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  const stats = {
    totalPatients: patients.length,
    newPatientsThisMonth: patients.filter(p => p.created_at >= firstDayOfMonth).length,
    patientsWithAlerts: patients.filter(p => p.medical_alerts).length,
    todayAppointments: todayCountResult.count ?? 0,
  }

  // ── Build upcoming appointments MAP (O(1) lookup vs O(n) find) ──────
  const upcomingMap = new Map<string, { appointment_datetime: string; doctor_name: string | null }>()
  for (const a of upcomingAppts) {
    if (!upcomingMap.has(a.patient_id)) {
      upcomingMap.set(a.patient_id, a)
    }
  }

  // ── Build clinical reports MAP ──────────────────────────────────────
  const reportMap = new Map<string, string>()
  for (const r of clinicalReports) {
    if (!reportMap.has(r.patient_id)) {
      reportMap.set(r.patient_id, r.created_at)
    }
  }

  // ── Merge metadata onto patients ─────────────────────────────────────
  const patientsWithMeta = patients.map(p => {
    const nextAppt = upcomingMap.get(p.id)
    return {
      ...p,
      next_appointment: nextAppt?.appointment_datetime ?? null,
      next_appointment_doctor: nextAppt?.doctor_name ?? null,
      latest_report_at: reportMap.get(p.id) ?? null,
    }
  }) as Patient[]

  return (
    <AdminDashboardClient
      initialPatients={patientsWithMeta}
      stats={stats}
      activeCategory={category ?? null}
    />
  )
}

