import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import TerminiClient from '@/components/admin/TerminiClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'SP DENT — Termini',
}

interface AppointmentWithPatient {
  id: string
  appointment_datetime: string
  doctor_name: string | null
  treatment_today: string | null
  reminder_sent: boolean
  patient: {
    id: string
    first_name: string
    last_name: string | null
    phone: string
    category: string
  }
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  regular: { label: 'Regularni', color: 'text-slate-400' },
  implant: { label: 'Implant', color: 'text-sky-400' },
  proteza: { label: 'Protetika', color: 'text-violet-400' },
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('sr-RS', {
    timeZone: 'Europe/Belgrade',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function formatDateHeading(iso: string) {
  const d = new Intl.DateTimeFormat('sr-RS', {
    timeZone: 'Europe/Belgrade',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
  return d.charAt(0).toUpperCase() + d.slice(1)
}

function isoToDateKey(iso: string) {
  // Group by Belgrade date (YYYY-MM-DD)
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Belgrade',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function isToday(dateKey: string) {
  const todayKey = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Belgrade',
  }).format(new Date())
  return dateKey === todayKey
}

export default async function TerminiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  // Belgrade midnight for today
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)

  const { data: appointments, error } = await supabase
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
    .gte('appointment_datetime', todayMidnight.toISOString())
    .order('appointment_datetime', { ascending: true })

  if (error) {
    console.error('[TerminiPage] fetch error:', error.message)
  }

  const appts = (appointments as unknown as AppointmentWithPatient[]) ?? []

  // Group by date
  const grouped = appts.reduce<Record<string, AppointmentWithPatient[]>>((acc, appt) => {
    const key = isoToDateKey(appt.appointment_datetime)
    if (!acc[key]) acc[key] = []
    acc[key].push(appt)
    return acc
  }, {})

  const sortedKeys = Object.keys(grouped).sort()

  return (
    <div className="min-h-screen bg-slate-950 p-6 pt-20 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <CalendarDays className="text-sky-400" size={24} />
          <h1 className="text-2xl font-bold text-white tracking-tight">Termini</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Hronološki pregled svih zakazanih termina od danas nadalje
        </p>
      </div>

      {appts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center mb-4">
            <CalendarDays size={32} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">Nema zakazanih termina</p>
          <p className="text-slate-600 text-sm mt-1">Termini se dodaju u kartonu pacijenta</p>
        </div>
      ) : (
        <div className="space-y-10 max-w-3xl">
          {sortedKeys.map((dateKey) => {
            const dayAppts = grouped[dateKey]
            const today = isToday(dateKey)

            return (
              <div key={dateKey}>
                {/* Day heading */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`px-3 py-1 rounded-lg text-sm font-bold ${
                    today
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      : 'bg-slate-800 text-slate-400 border border-white/5'
                  }`}>
                    {today ? '🗓 Danas' : formatDateHeading(dayAppts[0].appointment_datetime)}
                  </div>
                  {today && (
                    <span className="text-slate-500 text-sm">
                      {formatDateHeading(dayAppts[0].appointment_datetime)}
                    </span>
                  )}
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-slate-600 text-xs">{dayAppts.length} termin{dayAppts.length !== 1 ? 'a' : ''}</span>
                </div>

                {/* Appointments */}
                <TerminiClient
                  appointments={dayAppts}
                  dateKey={dateKey}
                  today={today}
                  CATEGORY_LABELS={CATEGORY_LABELS}
                  formatTime={formatTime}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
