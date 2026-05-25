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
  let patientsQuery = supabase
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false })

  if (category && ['regular', 'implant', 'proteza'].includes(category)) {
    patientsQuery = patientsQuery.eq('category', category)
  }

  const { data: patients, error } = await patientsQuery

  if (error) {
    console.error('[AdminDashboard] Failed to fetch patients:', error.message)
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
    totalPatients: patients?.length ?? 0,
    newPatientsThisMonth: patients?.filter(p => p.created_at >= firstDayOfMonth).length ?? 0,
    patientsWithAlerts: patients?.filter(p => p.medical_alerts).length ?? 0,
    todayAppointments: todayAppointments?.length ?? 0,
  }

  // Fetch upcoming appointments → next_appointment per patient
  const { data: upcomingAppts } = await supabase
    .from('appointments')
    .select('patient_id, appointment_datetime, doctor_name')
    .gte('appointment_datetime', today.toISOString())
    .order('appointment_datetime', { ascending: true })

  // Fetch latest clinical report per patient → for "Poslednje ažurirani" sort
  const patientIds = (patients ?? []).map(p => p.id)
  let latestReports: { patient_id: string; max_created: string }[] = []

  if (patientIds.length > 0) {
    const { data: reportData } = await supabase
      .from('clinical_reports')
      .select('patient_id, created_at')
      .in('patient_id', patientIds)
      .order('created_at', { ascending: false })

    // Client-side MAX per patient_id (avoid custom RPC for now)
    const seenPatients = new Set<string>()
    latestReports = (reportData ?? [])
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
