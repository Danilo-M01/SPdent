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

  const { data: rawAppointments, error } = await supabase
    .from('appointments')
    .select(`
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
    `)
    .gte('appointment_datetime', startRange.toISOString())
    .order('appointment_datetime', { ascending: true })

  if (error) {
    console.error('[TerminiPage] fetch error:', error.message)
  }

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

  // Fetch all patients for the quick booking dropdown list (autocomplete)
  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id, first_name, last_name, phone, category')
    .order('first_name', { ascending: true })

  if (patientsError) {
    console.error('[TerminiPage] patients fetch error:', patientsError.message)
  }

  return (
    <TerminiClient
      initialAppointments={appointments}
      patients={(patients as unknown as Patient[]) || []}
    />
  )
}

