'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Patient } from '@/app/admin/(dashboard)/page'
import PatientCard from './PatientCard'
import GlobalSearch from './GlobalSearch'
import AddPatientModal from './AddPatientModal'
import ExcelImporter from './ExcelImporter'
import PatientDossierModal from './PatientDossierModal'
import { Users, AlertTriangle, CalendarDays, Plus, Filter, FileText } from 'lucide-react'

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
  regular: { label: 'Regularni pacijenti', color: 'text-slate-600' },
  implant: { label: 'Implantologija', color: 'text-[#0284C7]' },
  proteza: { label: 'Protetika', color: 'text-violet-750' },
}

const statCards = (stats: Stats) => [
  { label: 'Ukupno pacijenata', value: stats.totalPatients, icon: Users, color: 'sky' },
  { label: 'Novi ovog meseca', value: stats.newPatientsThisMonth, icon: Users, color: 'amber' },
  { label: 'Termini danas', value: stats.todayAppointments, icon: CalendarDays, color: 'emerald' },
]

const colorMap: Record<string, string> = {
  sky: 'bg-sky-50 border border-sky-100 text-[#0EA5E9]',
  red: 'bg-red-50 border border-red-100 text-[#EF4444]',
  amber: 'bg-amber-50 border border-amber-100 text-[#F59E0B]',
  emerald: 'bg-emerald-50 border border-emerald-100 text-[#10B981]',
}

type SortBy = 'appointment' | 'chart_asc' | 'chart_desc' | 'alphabetical' | 'newest' | 'recently_updated'
type ChartFilter = 'all' | 'has_chart' | 'no_chart'

function normalizeSearch(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'dj')
    .replace(/љ/g, 'lj')
    .replace(/њ/g, 'nj')
    .replace(/џ/g, 'dz')
    .replace(/а/g, 'a').replace(/б/g, 'b').replace(/в/g, 'v').replace(/г/g, 'g')
    .replace(/д/g, 'd').replace(/ђ/g, 'dj').replace(/е/g, 'e').replace(/ж/g, 'z')
    .replace(/з/g, 'z').replace(/и/g, 'i').replace(/ј/g, 'j').replace(/к/g, 'k')
    .replace(/л/g, 'l').replace(/м/g, 'm').replace(/н/g, 'n').replace(/о/g, 'o')
    .replace(/п/g, 'p').replace(/р/g, 'r').replace(/с/g, 's').replace(/т/g, 't')
    .replace(/ћ/g, 'c').replace(/у/g, 'u').replace(/ф/g, 'f').replace(/х/g, 'h')
    .replace(/ц/g, 'c').replace(/ч/g, 'c').replace(/ш/g, 's')
}

function cleanPhoneCore(digits: string): string {
  let core = digits
  if (core.startsWith('00381')) core = core.slice(5)
  else if (core.startsWith('381')) core = core.slice(3)
  if (core.startsWith('0')) core = core.slice(1)
  return core
}

export default function AdminDashboardClient({
  initialPatients,
  stats,
  activeCategory,
}: AdminDashboardClientProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('appointment')
  const [chartFilter, setChartFilter] = useState<ChartFilter>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [smsStatus, setSmsStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [patients, setPatients] = useState<Patient[]>(initialPatients)
  const [localStats, setLocalStats] = useState(stats)
  const [visibleCount, setVisibleCount] = useState(48)

  const handleQueryChange = useCallback((val: string) => {
    setQuery(val)
    setVisibleCount(48)
  }, [])

  // Pre-index patients for search — only recomputed when patients list changes, NEVER on keystroke
  const searchablePatients = useMemo(() => {
    return patients.map(p => {
      const chartStr = (p.chart_number ?? '').trim()
      const chartLc = chartStr.toLowerCase()
      const chartClean = chartLc.replace(/[^a-z0-9]/gi, '')
      const nameStr = `${p.first_name} ${p.last_name ?? ''} ${p.parent_name ?? ''}`

      return {
        patient: p,
        hasChart: Boolean(chartStr),
        searchKey: normalizeSearch(`${nameStr} ${chartStr ? `karton ${chartStr} #${chartStr} br ${chartStr}` : ''}`),
        phoneDigits: p.phone.replace(/[^0-9]/g, ''),
        phoneCore: cleanPhoneCore(p.phone.replace(/[^0-9]/g, '')),
        rawPhone: p.phone.toLowerCase(),
        chartNumberLc: chartLc,
        chartClean: chartClean,
      }
    })
  }, [patients])

  useEffect(() => {
    setPatients(initialPatients)
  }, [initialPatients])

  useEffect(() => {
    setLocalStats(stats)
  }, [stats])

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
    let result = searchablePatients

    // 1. Chart presence filter
    if (chartFilter === 'has_chart') {
      result = result.filter(item => item.hasChart)
    } else if (chartFilter === 'no_chart') {
      result = result.filter(item => !item.hasChart)
    }

    // 2. Query search
    const trimmed = query.trim()
    let filteredList: Patient[]

    if (trimmed) {
      const qNorm = normalizeSearch(trimmed)
      const qDigits = trimmed.replace(/[^0-9]/g, '')
      const qRaw = trimmed.toLowerCase()
      const qClean = qRaw.replace(/[^a-z0-9]/gi, '')

      // If user typed prefixes like "karton 123", "karton: 123", "#123", "br 123", "k. 123"
      const cleanChartQuery = qRaw
        .replace(/^(karton[:\s]*|broj\s*kartona[:\s]*|br\.?[:\s]*kartona[:\s]*|br\.?[:\s]*|k\.?[:\s]*|#\s*)/i, '')
        .trim()
      const cleanChartDigits = cleanChartQuery.replace(/[^0-9]/g, '')

      const words = qNorm.split(/\s+/).filter(Boolean)

      const qCore = cleanPhoneCore(qDigits)

      filteredList = result
        .filter(item => {
          if (item.searchKey.includes(qNorm)) return true
          if (words.length > 1 && words.every(w => item.searchKey.includes(w))) return true
          if (item.chartNumberLc && item.chartNumberLc.includes(qRaw)) return true
          if (qClean && item.chartClean && item.chartClean.includes(qClean)) return true
          if (cleanChartQuery && item.chartNumberLc && item.chartNumberLc.includes(cleanChartQuery)) return true
          if (cleanChartDigits && item.chartClean && item.chartClean.includes(cleanChartDigits)) return true
          
          // Flexible phone search (handles +381, 06x, dashes, spaces, partial digits)
          if (!item.patient.phone.startsWith('/')) {
            if (item.rawPhone.includes(qRaw)) return true
            if (qDigits.length >= 2 && item.phoneDigits.includes(qDigits)) return true
            if (qCore.length >= 2 && item.phoneCore.includes(qCore)) return true
            if (qCore.length >= 2 && item.phoneDigits.includes(qCore)) return true
          }

          return false
        })
        .map(item => item.patient)
    } else {
      filteredList = result.map(item => item.patient)
    }

    // 3. Sorting
    return [...filteredList].sort((a, b) => {
      switch (sortBy) {
        case 'chart_asc': {
          const aChart = (a.chart_number ?? '').trim()
          const bChart = (b.chart_number ?? '').trim()
          if (aChart && bChart) {
            return aChart.localeCompare(bChart, undefined, { numeric: true, sensitivity: 'base' })
          }
          if (aChart) return -1
          if (bChart) return 1
          return a.first_name.localeCompare(b.first_name, 'sr-RS')
        }
        case 'chart_desc': {
          const aChart = (a.chart_number ?? '').trim()
          const bChart = (b.chart_number ?? '').trim()
          if (aChart && bChart) {
            return bChart.localeCompare(aChart, undefined, { numeric: true, sensitivity: 'base' })
          }
          if (aChart) return -1
          if (bChart) return 1
          return a.first_name.localeCompare(b.first_name, 'sr-RS')
        }
        case 'appointment': {
          if (a.next_appointment && b.next_appointment) {
            return a.next_appointment < b.next_appointment ? -1 : a.next_appointment > b.next_appointment ? 1 : 0
          }
          if (a.next_appointment) return -1
          if (b.next_appointment) return 1
          return a.first_name.localeCompare(b.first_name, 'sr-RS')
        }
        case 'alphabetical':
          return a.first_name.localeCompare(b.first_name, 'sr-RS')
        case 'newest':
          // created_at is ISO — string comparison works perfectly
          return b.created_at < a.created_at ? -1 : b.created_at > a.created_at ? 1 : 0
        case 'recently_updated': {
          const aT = a.latest_report_at ?? ''
          const bT = b.latest_report_at ?? ''
          return bT < aT ? -1 : bT > aT ? 1 : 0
        }
        default:
          return 0
      }
    })
  }, [query, sortBy, chartFilter, searchablePatients])

  const renderedPatients = useMemo(() => {
    return filteredPatients.slice(0, visibleCount)
  }, [filteredPatients, visibleCount])

  const catMeta = activeCategory ? CATEGORY_META[activeCategory] : null

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 pt-20 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Kontrolna tabla</h1>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] text-xs select-none shrink-0 shadow-sm">
              <span className="relative flex h-2 w-2">
                {smsStatus === 'online' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  smsStatus === 'online' ? 'bg-emerald-500' :
                  smsStatus === 'offline' ? 'bg-rose-500' : 'bg-amber-500'
                }`}></span>
              </span>
              <span className="text-slate-500 font-medium">
                SMS podsetnici: {smsStatus === 'online' ? 'ONLINE' : smsStatus === 'offline' ? 'OFFLINE' : 'Provera...'}
              </span>
            </div>
            {catMeta && (
              <span className={`text-base font-bold shrink-0 pl-1 ${catMeta.color}`}>
                {catMeta.label}
              </span>
            )}
          </div>
          <p className="text-slate-550 text-sm mt-1">Upravljanje pacijentima i terminima</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer shrink-0 shadow-sm"
          >
            Import
          </button>
          <button
            id="add-patient-btn"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-[#0284C7] hover:bg-sky-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer shrink-0 shadow-sm"
          >
            <Plus size={16} />
            Novi pacijent
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-4xl">
        {statCards(localStats).map(({ label, value, icon: Icon, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="text-slate-500 text-xs font-medium truncate">{label}</p>
              <p className="text-xl font-bold text-slate-900 mt-1 tracking-tight">{value}</p>
            </div>
            <div className={`p-2.5 rounded-lg border shrink-0 ${colorMap[color]}`}>
              <Icon size={16} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search + Filter + Sort */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full">
          <GlobalSearch query={query} onQueryChange={handleQueryChange} totalCount={filteredPatients.length} />
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap w-full md:w-auto">
          {/* Chart Filter */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm flex-1 sm:flex-initial">
            <FileText size={15} className="text-[#0284C7] shrink-0" />
            <select
              value={chartFilter}
              onChange={(e) => { setChartFilter(e.target.value as ChartFilter); setVisibleCount(48); }}
              className="bg-transparent text-slate-700 text-sm font-medium outline-none cursor-pointer pr-1 w-full sm:w-auto"
              aria-label="Filter po kartonu"
            >
              <option value="all">Svi kartoni</option>
              <option value="has_chart">Sa kartonom</option>
              <option value="no_chart">Bez kartona</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm flex-1 sm:flex-initial">
            <Filter size={15} className="text-slate-500 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as SortBy); setVisibleCount(48); }}
              className="bg-transparent text-slate-700 text-sm font-medium outline-none cursor-pointer pr-1 w-full sm:w-auto"
              aria-label="Sortiranje"
            >
              <option value="appointment">Najbliži termin prvo</option>
              <option value="chart_asc">Broj kartona (1 → 999)</option>
              <option value="chart_desc">Broj kartona (999 → 1)</option>
              <option value="alphabetical">Abecedno (A–Z)</option>
              <option value="newest">Poslednje dodati</option>
              <option value="recently_updated">Poslednje ažurirani</option>
            </select>
          </div>
        </div>
      </div>

      {/* Patient grid */}
      {filteredPatients.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-slate-400" />
          </div>
          <p className="text-slate-700 font-medium">
            {query ? 'Nema pacijenata koji odgovaraju pretrazi' : 'Nema pacijenata'}
          </p>
          {!query && (
            <p className="text-slate-500 text-sm mt-1">
              Kliknite &ldquo;Novi pacijent&rdquo; da dodate prvog
            </p>
          )}
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {renderedPatients.map((patient, i) => (
              <div key={patient.id} onClick={() => setSelectedPatient(patient)} className="cursor-pointer">
                <PatientCard patient={patient} index={i} />
              </div>
            ))}
          </div>

          {filteredPatients.length > visibleCount && (
            <div className="flex justify-center mt-10">
              <button
                onClick={() => setVisibleCount(prev => prev + 48)}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl text-sm font-semibold tracking-wide transition-all cursor-pointer shadow-sm hover:shadow-md shrink-0"
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
          <AddPatientModal
            onClose={() => setShowAddModal(false)}
            onPatientAdded={(newPatient) => {
              setPatients(prev => [newPatient, ...prev])
              setLocalStats(prev => ({
                ...prev,
                totalPatients: prev.totalPatients + 1,
                newPatientsThisMonth: prev.newPatientsThisMonth + 1,
              }))
            }}
          />
        )}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:pl-64">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowImportModal(false)} />
            <div className="relative w-full max-w-3xl z-10">
              <ExcelImporter
                onClose={() => setShowImportModal(false)}
                onImportSuccess={() => router.refresh()}
              />
            </div>
          </div>
        )}
        {selectedPatient && (
          <PatientDossierModal
            key={selectedPatient.id}
            patient={selectedPatient}
            onClose={() => setSelectedPatient(null)}
            onPatientUpdated={(updated) => {
              setPatients(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
            }}
            onPatientDeleted={(deletedId) => {
              setPatients(prev => prev.filter(p => p.id !== deletedId))
              setLocalStats(prev => ({ ...prev, totalPatients: prev.totalPatients - 1 }))
              setSelectedPatient(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
