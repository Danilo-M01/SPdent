'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Patient } from '@/app/admin/(dashboard)/page'
import PatientCard from './PatientCard'
import GlobalSearch from './GlobalSearch'
import AddPatientModal from './AddPatientModal'
import ExcelImporter from './ExcelImporter'
import PatientDossierModal from './PatientDossierModal'
import { Users, AlertTriangle, CalendarDays, Plus, Filter } from 'lucide-react'

interface Stats {
  totalPatients: number
  newPatientsThisMonth: number
  patientsWithAlerts: number
  todayAppointments: number
}

interface AdminDashboardClientProps {
  initialPatients: Patient[]
  stats: Stats
  activeCategory: string | null
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  regular: { label: 'Regularni pacijenti', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  implant: { label: 'Implantologija', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  proteza: { label: 'Protetika', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
}

const statCards = (stats: Stats) => [
  { label: 'Ukupno pacijenata', value: stats.totalPatients, icon: Users, color: 'sky' },
  { label: 'Medicinska upozorenja', value: stats.patientsWithAlerts, icon: AlertTriangle, color: 'red' },
  { label: 'Novi ovog meseca', value: stats.newPatientsThisMonth, icon: Users, color: 'amber' },
  { label: 'Termini danas', value: stats.todayAppointments, icon: CalendarDays, color: 'emerald' },
]

const colorMap: Record<string, string> = {
  sky: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
  red: 'bg-red-500/10 border-red-500/20 text-red-400',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
}

type SortBy = 'appointment' | 'alphabetical' | 'newest' | 'recently_updated'

export default function AdminDashboardClient({
  initialPatients,
  stats,
  activeCategory,
}: AdminDashboardClientProps) {
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('appointment')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [smsStatus, setSmsStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    const supabase = createClient()

    const checkStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('system_logs')
          .select('created_at')
          .eq('component', 'sms_worker')
          .eq('message', 'Heartbeat')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) throw error

        if (data && data.created_at) {
          const lastTime = new Date(data.created_at).getTime()
          const nowTime = new Date().getTime()
          // If last heartbeat is within 15 minutes, it's ONLINE
          if (nowTime - lastTime < 15 * 60 * 1000) {
            setSmsStatus('online')
            return
          }
        }
        setSmsStatus('offline')
      } catch (err) {
        console.error('Failed to fetch SMS status heartbeat:', err)
        setSmsStatus('offline')
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 30000) // check every 30s
    return () => clearInterval(interval)
  }, [])

  const filteredPatients = useMemo(() => {
    let result = initialPatients

    if (query.trim()) {
      const q = query.toLowerCase().trim()
      result = result.filter(p => {
        const fullName = `${p.first_name} ${p.last_name ?? ''}`.toLowerCase()
        return fullName.includes(q) || p.phone.includes(q)
      })
    }

    return result.sort((a, b) => {
      switch (sortBy) {
        case 'appointment': {
          if (a.next_appointment && b.next_appointment) {
            return new Date(a.next_appointment).getTime() - new Date(b.next_appointment).getTime()
          }
          if (a.next_appointment) return -1
          if (b.next_appointment) return 1
          return a.first_name.localeCompare(b.first_name, 'sr-RS')
        }
        case 'alphabetical':
          return a.first_name.localeCompare(b.first_name, 'sr-RS')
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'recently_updated': {
          const aTime = a.latest_report_at ? new Date(a.latest_report_at).getTime() : 0
          const bTime = b.latest_report_at ? new Date(b.latest_report_at).getTime() : 0
          return bTime - aTime
        }
        default:
          return 0
      }
    })
  }, [query, sortBy, initialPatients])

  const [visibleCount, setVisibleCount] = useState(48)

  const renderedPatients = useMemo(() => {
    return filteredPatients.slice(0, visibleCount)
  }, [filteredPatients, visibleCount])

  const catMeta = activeCategory ? CATEGORY_META[activeCategory] : null

  return (
    <div className="min-h-screen bg-slate-950 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Kontrolna tabla</h1>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-white/5 text-xs select-none">
              <span className="relative flex h-2 w-2">
                {smsStatus === 'online' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  smsStatus === 'online' ? 'bg-emerald-500' :
                  smsStatus === 'offline' ? 'bg-rose-500' : 'bg-amber-500'
                }`}></span>
              </span>
              <span className="text-slate-400 font-medium">
                SMS podsetnici: {smsStatus === 'online' ? 'ONLINE' : smsStatus === 'offline' ? 'OFFLINE' : 'Provera...'}
              </span>
            </div>
            {catMeta && (
              <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${catMeta.color}`}>
                {catMeta.label}
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-1">Upravljanje pacijentima i terminima</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer shrink-0"
          >
            Import
          </button>
          <button
            id="add-patient-btn"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer shrink-0"
          >
            <Plus size={16} />
            Novi pacijent
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards(stats).map(({ label, value, icon: Icon, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="text-slate-500 text-xs font-medium truncate">{label}</p>
              <p className="text-xl font-bold text-white mt-1 tracking-tight">{value}</p>
            </div>
            <div className={`p-2.5 rounded-lg border shrink-0 ${colorMap[color]}`}>
              <Icon size={16} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search + Sort */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full">
          <GlobalSearch query={query} onQueryChange={(val) => { setQuery(val); setVisibleCount(48); }} totalCount={filteredPatients.length} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Filter size={15} className="text-slate-500" />
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortBy); setVisibleCount(48); }}
            className="bg-slate-900 border border-white/10 text-slate-300 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-sky-500/50 appearance-none cursor-pointer"
          >
            <option value="appointment">Najbliži termin prvo</option>
            <option value="alphabetical">Abecedno (A–Z)</option>
            <option value="newest">Poslednje dodati</option>
            <option value="recently_updated">Poslednje ažurirani</option>
          </select>
        </div>
      </div>

      {/* Patient grid */}
      {filteredPatients.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-white/5 flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-slate-500" />
          </div>
          <p className="text-slate-400 font-medium">
            {query ? 'Nema pacijenata koji odgovaraju pretrazi' : 'Nema pacijenata'}
          </p>
          {!query && (
            <p className="text-slate-600 text-sm mt-1">
              Kliknite &ldquo;Novi pacijent&rdquo; da dodate prvog
            </p>
          )}
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <AnimatePresence mode="popLayout">
              {renderedPatients.map((patient, i) => (
                <div key={patient.id} onClick={() => setSelectedPatient(patient)} className="cursor-pointer">
                  <PatientCard patient={patient} index={i} />
                </div>
              ))}
            </AnimatePresence>
          </div>

          {filteredPatients.length > visibleCount && (
            <div className="flex justify-center mt-10">
              <button
                onClick={() => setVisibleCount(prev => prev + 48)}
                className="bg-slate-900/60 hover:bg-slate-800 border border-white/5 hover:border-white/10 text-slate-300 hover:text-white px-6 py-3 rounded-2xl text-sm font-semibold tracking-wide transition-all cursor-pointer shadow-lg hover:shadow-xl shrink-0"
              >
                Prikaži još pacijenata ({filteredPatients.length - visibleCount} preostalo)
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showAddModal && (
          <AddPatientModal onClose={() => setShowAddModal(false)} />
        )}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowImportModal(false)} />
            <div className="relative w-full max-w-3xl z-10">
              <ExcelImporter onClose={() => setShowImportModal(false)} />
            </div>
          </div>
        )}
        {selectedPatient && (
          <PatientDossierModal
            key={selectedPatient.id}
            patient={selectedPatient}
            onClose={() => setSelectedPatient(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
