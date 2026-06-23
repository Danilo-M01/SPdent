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

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { category } = await searchParams

  // Build patient query — filter by category if provided
  const patients: Patient[] = []
  let patientsOffset = 0
  const PAGE_LIMIT = 1000
  let patientsHasMore = true

  while (patientsHasMore) {
    let patientsQuery = supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false })
      .range(patientsOffset, patientsOffset + PAGE_LIMIT - 1)

    if (category && ['regular', 'implant', 'proteza'].includes(category)) {
      patientsQuery = patientsQuery.eq('category', category)
    }

    const { data: pageData, error } = await patientsQuery

    if (error) {
      console.error('[AdminDashboard] Failed to fetch patients:', error.message)
      break
    }

    if (pageData && pageData.length > 0) {
      patients.push(...(pageData as unknown as Patient[]))
      patientsOffset += PAGE_LIMIT
      if (pageData.length < PAGE_LIMIT) {
        patientsHasMore = false
      }
    } else {
      patientsHasMore = false
    }
  }

  // Today's appointments count
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data: todayAppointments } = await supabase
    .from('appointments')
    .select('id', { count: 'exact' })
    .gte('appointment_datetime', today.toISOString())
    .lt('appointment_datetime', tomorrow.toISOString())

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  const stats = {
    totalPatients: patients.length,
    newPatientsThisMonth: patients.filter(p => p.created_at >= firstDayOfMonth).length,
    patientsWithAlerts: patients.filter(p => p.medical_alerts).length,
    todayAppointments: todayAppointments?.length ?? 0,
  }

  // Fetch upcoming appointments → next_appointment per patient
  const upcomingAppts: { patient_id: string; appointment_datetime: string; doctor_name: string | null }[] = []
  let upcomingOffset = 0
  let upcomingHasMore = true

  while (upcomingHasMore) {
    const { data: pageData, error } = await supabase
      .from('appointments')
      .select('patient_id, appointment_datetime, doctor_name')
      .gte('appointment_datetime', today.toISOString())
      .order('appointment_datetime', { ascending: true })
      .range(upcomingOffset, upcomingOffset + PAGE_LIMIT - 1)

    if (error) {
      console.error('[AdminDashboard] Failed to fetch upcoming appointments:', error.message)
      break
    }

    if (pageData && pageData.length > 0) {
      upcomingAppts.push(...pageData)
      upcomingOffset += PAGE_LIMIT
      if (pageData.length < PAGE_LIMIT) {
        upcomingHasMore = false
      }
    } else {
      upcomingHasMore = false
    }
  }

  // Fetch latest clinical report per patient → for "Poslednje ažurirani" sort
  const patientIds = patients.map(p => p.id)
  let latestReports: { patient_id: string; max_created: string }[] = []

  if (patientIds.length > 0) {
    const reportData: { patient_id: string; created_at: string }[] = []
    const BATCH_SIZE = 250

    for (let i = 0; i < patientIds.length; i += BATCH_SIZE) {
      const batchIds = patientIds.slice(i, i + BATCH_SIZE)
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const { data: pageData, error } = await supabase
          .from('clinical_reports')
          .select('patient_id, created_at')
          .in('patient_id', batchIds)
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_LIMIT - 1)

        if (error) {
          console.error('[AdminDashboard] Failed to fetch report data:', error.message)
          break
        }

        if (pageData && pageData.length > 0) {
          reportData.push(...pageData)
          offset += PAGE_LIMIT
          if (pageData.length < PAGE_LIMIT) {
            hasMore = false
          }
        } else {
          hasMore = false
        }
      }
    }

    // Client-side MAX per patient_id (avoid custom RPC for now)
    const seenPatients = new Set<string>()
    latestReports = reportData
      .filter(r => {
        if (seenPatients.has(r.patient_id)) return false
        seenPatients.add(r.patient_id)
        return true
      })
      .map(r => ({ patient_id: r.patient_id, max_created: r.created_at }))
  }

  const patientsWithMeta = (patients ?? []).map(p => {
    const nextAppt = upcomingAppts?.find(a => a.patient_id === p.id)
    const latestReport = latestReports.find(r => r.patient_id === p.id)
    return {
      ...p,
      next_appointment: nextAppt?.appointment_datetime ?? null,
      next_appointment_doctor: nextAppt?.doctor_name ?? null,
      latest_report_at: latestReport?.max_created ?? null,
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
