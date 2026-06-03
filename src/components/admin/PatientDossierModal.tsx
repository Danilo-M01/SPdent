'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  User,
  Phone,
  Mail,
  AlertTriangle,
  FileText,
  Plus,
  Save,
  Clock,
  Edit2,
  Calendar,
  Check,
  Stethoscope,
  Activity,
  ImageIcon,
  Trash2,
} from 'lucide-react'
import type { Patient } from '@/app/admin/(dashboard)/page'
import { updatePatient, addClinicalReport, addAppointment, deletePatient, deleteAppointment, updateAppointment } from '@/app/admin/actions'
import { createClient } from '@/lib/supabase/client'

// Lazy-load heavy components (chart + uploader) for faster initial modal open
const DentalChart = lazy(() => import('./DentalChart'))
const XRayUploader = lazy(() => import('./XRayUploader'))

interface PatientDossierModalProps {
  patient: Patient
  onClose: () => void
  onPatientDeleted?: (patientId: string) => void
}

interface ClinicalReport {
  id: string
  anamneza: string | null
  nalaz: string | null
  terapija: string | null
  savet: string | null
  doctor_name: string | null
  services_provided: string[]
  future_treatment_plan: string | null
  created_at: string
}

type ToothStatus = 'healthy' | 'caries' | 'filled' | 'missing' | 'implant' | 'crown'

interface ToothState {
  status: ToothStatus
  notes?: string
}

interface DossierAppointment {
  id: string
  patient_id: string
  appointment_datetime: string
  doctor_name: string | null
  treatment_today: string | null
  reminder_sent: boolean
  created_at: string
}

interface DBToothStatus {
  tooth_number: number
  status: string
}

const CATALOG_ZONES = [
  {
    title: 'PREVENTIVNA I ESTETSKA STOMATOLOGIJA',
    color: 'border-emerald-200 text-emerald-700 bg-emerald-50',
    activeColor: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
    items: [
      { slug: 'Uklanjanje kamenca i poliranje', label: 'Uklanjanje kamenca i poliranje' },
      { slug: 'Beljenje zuba', label: 'Beljenje zuba' },
      { slug: 'Keramički viniri (Fasete)', label: 'Keramički viniri (Fasete)' },
      { slug: 'Estetske kompozitne plombe', label: 'Estetske kompozitne plombe' },
    ]
  },
  {
    title: 'ENDODONCIJA (LEČENJE ZUBA)',
    color: 'border-amber-200 text-amber-800 bg-amber-50',
    activeColor: 'bg-amber-650 text-white border-amber-650 shadow-sm',
    items: [
      { slug: 'Mašinsko lečenje kanala korena', label: 'Mašinsko lečenje kanala korena' },
      { slug: 'Lečenje i reanimacija živca', label: 'Lečenje i reanimacija živca' },
    ]
  },
  {
    title: 'ORALNA HIRURGIJA I IMPLANTOLOGIJA',
    color: 'border-rose-200 text-rose-700 bg-rose-50',
    activeColor: 'bg-rose-600 text-white border-rose-600 shadow-sm',
    items: [
      { slug: 'Rutinsko vađenje zuba', label: 'Rutinsko vađenje zuba' },
      { slug: 'Hirurško vađenje umnjaka', label: 'Hirurško vađenje umnjaka' },
      { slug: 'Ugradnja zubnih implantata', label: 'Ugradnja zubnih implantata' },
      { slug: 'Sinus lift i augmentacija kosti', label: 'Sinus lift i augmentacija kosti' },
    ]
  },
  {
    title: 'STOMATOLOŠKA PROTETIKA',
    color: 'border-violet-200 text-violet-750 bg-violet-50',
    activeColor: 'bg-violet-650 text-white border-violet-650 shadow-sm',
    items: [
      { slug: 'Bezmetalne cirkonijum krunice', label: 'Bezmetalne cirkonijum krunice' },
      { slug: 'Metalokeramičke krunice', label: 'Metalokeramičke krunice' },
      { slug: 'Krunice na implantatima', label: 'Krunice na implantatima' },
      { slug: 'Totalne i parcijalne proteze', label: 'Totalne i parcijalne proteze' },
    ]
  },
  {
    title: 'PARODONTOLOGIJA I DEČIJA STOMATOLOGIJA',
    color: 'border-sky-200 text-sky-700 bg-sky-50',
    activeColor: 'bg-sky-600 text-white border-sky-600 shadow-sm',
    items: [
      { slug: 'Kiretaža parodontalnih džepova', label: 'Kiretaža parodontalnih džepova' },
      { slug: 'Zalivanje fisura (Deca)', label: 'Zalivanje fisura (Deca)' },
      { slug: 'Vađenje mlečnih zuba', label: 'Vađenje mlečnih zuba' },
    ]
  },
]

// Find style for a saved service tag to display it with appropriate colors in timeline
function getServiceTagClass(service: string) {
  for (const zone of CATALOG_ZONES) {
    if (zone.items.some(item => item.slug === service || item.label === service)) {
      return zone.color + ' border'
    }
  }
  return 'border-slate-200 text-slate-650 bg-slate-50 border'
}

export default function PatientDossierModal({ patient: initialPatient, onClose, onPatientDeleted }: PatientDossierModalProps) {
  const [activeTab, setActiveTab] = useState<'history' | 'appointments' | 'new_report' | 'edit_patient' | 'dental_chart' | 'xrays'>('history')
  const [patient, setPatient] = useState(initialPatient)
  const [reports, setReports] = useState<ClinicalReport[]>([])
  const [appointments, setAppointments] = useState<DossierAppointment[]>([])
  const [toothData, setToothData] = useState<Record<number, ToothState>>({})
  const [isLoadingReports, setIsLoadingReports] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingApptId, setEditingApptId] = useState<string | null>(null)
  const [editDatetime, setEditDatetime] = useState<string>('')
  const [editDoctor, setEditDoctor] = useState<string>('dr Slaviša Petković')

  const handleDeletePatient = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await deletePatient(patient.id)
      if (res.success) {
        // Notify parent to remove patient from list reactively
        onPatientDeleted?.(patient.id)
        setTimeout(() => {
          onClose()
        }, 400)
      } else {
        setError(res.error || 'Greška pri brisanju pacijenta.')
        setIsSubmitting(false)
      }
    } catch (err) {
      console.error(err)
      setError('Greška pri brisanju pacijenta.')
      setIsSubmitting(false)
    }
  }

  // Catalog State
  const [selectedDoctor, setSelectedDoctor] = useState<string>('dr Slaviša Petković')
  const [selectedServices, setSelectedServices] = useState<string[]>([])

  // Systemic anamnesis alerts
  const systemicAlerts: string[] = [
    patient.has_hypertension ? '🫀 Hipertenzija' : '',
    patient.has_diabetes ? '🩸 Dijabetes' : '',
    patient.takes_anticoagulants ? '💊 Antikoagulansi' : '',
    patient.penicillin_allergy ? '⚠️ Alergija na Penicilin' : '',
  ].filter(Boolean)

  useEffect(() => {
    const fetchReports = async () => {
      const supabase = createClient()
      const [{ data: reportData }, { data: apptData }, { data: toothDbData }] = await Promise.all([
        supabase.from('clinical_reports').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false }),
        supabase.from('appointments').select('*').eq('patient_id', patient.id).order('appointment_datetime', { ascending: false }),
        supabase.from('tooth_status').select('tooth_number, status').eq('patient_id', patient.id),
      ])

      setReports(reportData || [])
      setAppointments(apptData || [])

      if (toothDbData) {
        const map: Record<number, ToothState> = {}
        toothDbData.forEach((t: DBToothStatus) => { map[t.tooth_number] = { status: t.status as ToothStatus } })
        setToothData(map)
      }

      setIsLoadingReports(false)
    }
    fetchReports()
  }, [patient.id])

  const toggleService = (slug: string) => {
    setSelectedServices(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    )
  }

  const handleEditPatient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    const formData = new FormData(e.currentTarget)

    const result = await updatePatient(patient.id, null, formData)
    if (result.success) {
      // Fetch updated patient record to ensure perfect sync of generated fields and boolean alerts
      const supabase = createClient()
      const { data: updatedPatient } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patient.id)
        .single()

      if (updatedPatient) {
        setPatient(updatedPatient)
      } else {
        const rawPhone = String(formData.get('phone') ?? '').trim()
        setPatient({
          ...patient,
          first_name: String(formData.get('first_name')),
          last_name: String(formData.get('last_name')) || null,
          phone: (!rawPhone || rawPhone === '/') ? patient.phone : rawPhone,
          email: String(formData.get('email')) || null,
          parent_name: String(formData.get('parent_name')) || null,
          medical_alerts: String(formData.get('medical_alerts')) || null,
          notes: String(formData.get('notes')) || null,
          category: String(formData.get('category')),
          has_hypertension: formData.get('has_hypertension') === 'true',
          has_diabetes: formData.get('has_diabetes') === 'true',
          takes_anticoagulants: formData.get('takes_anticoagulants') === 'true',
          penicillin_allergy: formData.get('penicillin_allergy') === 'true',
          consent_signed: formData.get('consent_signed') === 'true',
        })
      }
      setActiveTab('history')
    } else {
      setError(result.error || 'Greška pri ažuriranju.')
    }
    setIsSubmitting(false)
  }

  const handleAddReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.append('doctor_name', selectedDoctor)
    formData.append('services_provided', JSON.stringify(selectedServices))

    const result = await addClinicalReport(patient.id, null, formData)
    if (result.success) {
      const supabase = createClient()
      const { data } = await supabase
        .from('clinical_reports')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false })

      setReports(data || [])
      // Reset inputs
      setSelectedServices([])
      setActiveTab('history')
    } else {
      setError(result.error || 'Greška pri čuvanju izveštaja.')
    }
    setIsSubmitting(false)
  }

  const formatBelgradeDate = (iso: string) => {
    return new Intl.DateTimeFormat('sr-RS', {
      timeZone: 'Europe/Belgrade',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  }

  const toLocalDatetimeString = (isoString: string): string => {
    const d = new Date(isoString)
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Belgrade',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false
    })
    const formatted = formatter.format(d)
    return formatted.replace(' ', 'T')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="relative w-full max-w-5xl h-[90vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header (Patient Info) */}
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex gap-4 items-center pr-12">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
              <User className="text-[#0284C7] w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {patient.first_name} {patient.last_name}
              </h2>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400" /> {patient.phone.startsWith('/') ? '/' : patient.phone}</span>
                {patient.email && <span className="flex items-center gap-1.5"><Mail size={14} className="text-slate-400" /> {patient.email}</span>}
                {patient.parent_name && <span className="text-slate-600 px-2 py-0.5 rounded-md bg-slate-100/85">Roditelj: {patient.parent_name}</span>}
              </div>
            </div>
          </div>

          {patient.medical_alerts && (
            <div className="bg-red-50 border border-red-150 rounded-xl px-4 py-3 max-w-sm flex gap-3 items-start shrink-0">
              <AlertTriangle className="text-red-650 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-red-700 text-xs font-bold uppercase tracking-wider mb-1">Medicinsko Upozorenje</p>
                <p className="text-red-600 text-sm leading-snug">{patient.medical_alerts}</p>
              </div>
            </div>
          )}
        </div>

        {/* Systemic Anamnesis Alert Banner */}
        {systemicAlerts.length > 0 && (
          <motion.div
            animate={{ opacity: [1, 0.8, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="shrink-0 bg-red-50/70 border-b border-red-100 px-6 py-3 flex flex-wrap items-center gap-2"
          >
            <Activity size={15} className="text-red-650 shrink-0" />
            <span className="text-red-700 text-xs font-bold uppercase tracking-wider mr-1">Sistemska Anamneza:</span>
            {systemicAlerts.map(alert => (
              <span key={alert} className="bg-red-100/60 border border-red-200 text-red-750 text-xs font-semibold px-2.5 py-1 rounded-lg">
                {alert}
              </span>
            ))}
          </motion.div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-1 border-b border-slate-100 px-6 pt-4 bg-white shrink-0 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'history' ? 'border-[#0284C7] text-[#0284C7]' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200'
            }`}
          >
            <FileText size={16} /> Istorija Pregleda
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'appointments' ? 'border-[#0284C7] text-[#0284C7]' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200'
            }`}
          >
            <Clock size={16} /> Termini
          </button>
          <button
            onClick={() => setActiveTab('new_report')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'new_report' ? 'border-[#0284C7] text-[#0284C7]' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200'
            }`}
          >
            <Plus size={16} /> Novi Izveštaj
          </button>
          <button
            onClick={() => setActiveTab('edit_patient')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ml-auto shrink-0 ${
              activeTab === 'edit_patient' ? 'border-[#0284C7] text-[#0284C7]' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200'
            }`}
          >
            <Edit2 size={16} /> Izmeni Podatke
          </button>
          <button
            onClick={() => setActiveTab('dental_chart')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'dental_chart' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200'
            }`}
          >
            <Activity size={16} /> Dentalni Karton
          </button>
          <button
            onClick={() => setActiveTab('xrays')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'xrays' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200'
            }`}
          >
            <ImageIcon size={16} /> RTG Snimci
          </button>
        </div>

        {/* Content Area */}
        <div data-lenis-prevent className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC] premium-scrollbar">

          {/* TAB: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-6 max-w-4xl mx-auto pb-10">
              {isLoadingReports ? (
                <div className="text-center py-10 text-slate-650">Učitavanje izveštaja...</div>
              ) : reports.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">Nema kliničkih izveštaja za ovog pacijenta.</p>
                  <button
                    onClick={() => setActiveTab('new_report')}
                    className="mt-4 text-[#0284C7] text-sm hover:text-sky-700 font-semibold"
                  >
                    + Dodaj prvi izveštaj
                  </button>
                </div>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#0284C7]" />
                    
                    <div className="flex items-center justify-between flex-wrap gap-2 text-slate-500 text-sm mb-4 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-[#0284C7]" />
                        <span className="font-semibold text-slate-700">{formatBelgradeDate(report.created_at)}</span>
                      </div>
                      {report.doctor_name && (
                        <div className="flex items-center gap-1 bg-sky-50 text-[#0284C7] border border-sky-100 rounded-md px-2 py-0.5 text-xs font-semibold">
                          <Stethoscope size={12} /> {report.doctor_name}
                        </div>
                      )}
                    </div>

                    {/* Services Render */}
                    {report.services_provided && report.services_provided.length > 0 && (
                      <div className="mb-5">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pružene Usluge</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {report.services_provided.map((s) => (
                            <span key={s} className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${getServiceTagClass(s)}`}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {report.anamneza && (
                        <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Anamneza</h4>
                          <p className="text-slate-750 text-sm whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-100">{report.anamneza}</p>
                        </div>
                      )}
                      {report.nalaz && (
                        <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Objektivni Nalaz</h4>
                          <p className="text-slate-750 text-sm whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-100">{report.nalaz}</p>
                        </div>
                      )}
                      {report.terapija && (
                        <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Terapija</h4>
                          <p className="text-slate-750 text-sm whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-100">{report.terapija}</p>
                        </div>
                      )}
                      {report.savet && (
                        <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Savet / Kontrola</h4>
                          <p className="text-slate-750 text-sm whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-100">{report.savet}</p>
                        </div>
                      )}
                      {report.future_treatment_plan && (
                        <div className="lg:col-span-2">
                          <h4 className="text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-2">Plan Budućeg Lečenja</h4>
                          <p className="text-[#0284C7] text-sm whitespace-pre-wrap bg-sky-50/50 p-3 rounded-xl border border-sky-100">{report.future_treatment_plan}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: APPOINTMENTS */}
          {activeTab === 'appointments' && (
            <div className="max-w-3xl mx-auto pb-10 space-y-8">
              <form
                action={async (formData) => {
                  setIsSubmitting(true)
                  setError(null)
                  const result = await addAppointment(null, formData)
                  if (result.success) {
                    const supabase = createClient()
                    const { data } = await supabase.from('appointments').select('*').eq('patient_id', patient.id).order('appointment_datetime', { ascending: false })
                    setAppointments(data || [])
                    const dt = new Date(String(formData.get('appointment_datetime')))
                    if (dt > new Date()) {
                      setPatient({ ...patient, next_appointment: dt.toISOString() })
                    }
                  } else {
                    setError(result.error || 'Greška pri dodavanju termina.')
                  }
                  setIsSubmitting(false)
                }}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
              >
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Clock className="text-[#0284C7]" /> Zakaži novi termin
                </h3>
                {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-150">{error}</div>}

                <input type="hidden" name="patient_id" value={patient.id} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div className="relative w-full">
                    <label className="block text-xs font-semibold text-slate-650 mb-1.5">Datum i Vreme *</label>
                    <div className="relative w-full">
                      <input
                        required
                        type="datetime-local"
                        name="appointment_datetime"
                        className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer relative z-10"
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-0">
                        <Calendar size={16} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-650 mb-1.5">Dežurni stomatolog</label>
                    <select
                      name="doctor_name"
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none transition-all duration-200"
                    >
                      <option value="dr Slaviša Petković">dr Slaviša Petković</option>
                      <option value="dr Nebojša Kostić">dr Nebojša Kostić</option>
                      <option value="dr Đurđina Grujić">dr Đurđina Grujić</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <button type="submit" disabled={isSubmitting} className="group relative px-6 py-2.5 rounded-xl text-sm font-bold text-white overflow-hidden transition-all disabled:opacity-50 shadow-sm active:scale-95 w-full h-[46px] cursor-pointer">
                      <div className="absolute inset-0 bg-[#0284C7] hover:bg-sky-600 transition-colors duration-300" />
                      <div className="relative flex items-center justify-center gap-2">
                        <Clock size={16} className="group-hover:rotate-12 transition-transform duration-300" />
                        Zakaži Termin
                      </div>
                    </button>
                  </div>
                </div>
              </form>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-6">Svi Termini</h3>
                {appointments.length === 0 ? (
                  <p className="text-slate-500 text-sm">Nema evidentiranih termina.</p>
                ) : (
                  <div className="space-y-3">
                    {appointments.map((appt) => {
                      const apptDate = new Date(appt.appointment_datetime)
                      const now = new Date()
                      const isFuture = apptDate > now

                      const tomorrowStart = new Date(now)
                      tomorrowStart.setDate(tomorrowStart.getDate() + 1)
                      tomorrowStart.setHours(0, 0, 0, 0)
                      const tomorrowEnd = new Date(tomorrowStart)
                      tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)

                      const isForTomorrow = apptDate >= tomorrowStart && apptDate < tomorrowEnd
                      const isBeyondTomorrow = apptDate >= tomorrowEnd

                      const hasPhone = patient.phone && !patient.phone.startsWith('/')
                      let smsStatus = null
                      if (!hasPhone) {
                        smsStatus = (
                          <span className="text-xs text-slate-500 font-medium flex items-center gap-1 shrink-0">
                            Nema tel
                          </span>
                        )
                      } else if (appt.reminder_sent) {
                        smsStatus = (
                          <span className="text-xs text-sky-700 bg-sky-50 border border-sky-100 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 shrink-0">
                            <Check size={12}/> SMS Poslat
                          </span>
                        )
                      } else if (isFuture) {
                        if (isForTomorrow) {
                          smsStatus = (
                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 shrink-0">
                              <Clock size={12}/> SMS večeras 18–21h
                            </span>
                          )
                        } else if (isBeyondTomorrow) {
                          smsStatus = (
                            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 shrink-0">
                              <Clock size={12}/> Podsetnik uključen
                            </span>
                          )
                        }
                      }

                      const isEditing = editingApptId === appt.id

                      if (isEditing) {
                        return (
                          <div key={appt.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3 animate-fadeIn">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-650 mb-1">Datum i Vreme</label>
                                <input
                                  type="datetime-local"
                                  value={editDatetime}
                                  onChange={e => setEditDatetime(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 text-xs outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-sky-500/10"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-650 mb-1">Lekar</label>
                                <select
                                  value={editDoctor}
                                  onChange={e => setEditDoctor(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 text-xs outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-sky-500/10"
                                >
                                  <option value="dr Slaviša Petković">dr Slaviša Petković</option>
                                  <option value="dr Nebojša Kostić">dr Nebojša Kostić</option>
                                  <option value="dr Đurđina Grujić">dr Đurđina Grujić</option>
                                </select>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => setEditingApptId(null)}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                Otkaži
                              </button>
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={async () => {
                                  setIsSubmitting(true)
                                  const res = await updateAppointment(appt.id, editDatetime, editDoctor)
                                  if (res.success) {
                                    // Refresh appointments list
                                    const supabase = createClient()
                                    const { data } = await supabase.from('appointments').select('*').eq('patient_id', patient.id).order('appointment_datetime', { ascending: false })
                                    setAppointments(data || [])
                                    setEditingApptId(null)
                                  } else {
                                    alert(res.error || 'Greška pri izmeni termina.')
                                  }
                                  setIsSubmitting(false)
                                }}
                                className="px-3 py-1 bg-[#0284C7] hover:bg-sky-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-55"
                              >
                                Sačuvaj
                              </button>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div key={appt.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-slate-100 gap-4 group/appt">
                          <div className="flex items-center gap-3">
                            <Clock size={16} className={isFuture ? 'text-emerald-600' : 'text-slate-400'} />
                            <div>
                              <span className={`font-semibold ${isFuture ? 'text-emerald-700' : 'text-slate-700'}`}>
                                {formatBelgradeDate(appt.appointment_datetime)}
                              </span>
                              {appt.doctor_name && (
                                <p className="text-slate-500 text-xs mt-0.5">{appt.doctor_name}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {smsStatus}
                            <div className="flex items-center gap-1 opacity-0 group-hover/appt:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingApptId(appt.id)
                                  setEditDatetime(toLocalDatetimeString(appt.appointment_datetime))
                                  setEditDoctor(appt.doctor_name || 'dr Slaviša Petković')
                                }}
                                className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                                title="Izmeni termin"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={async () => {
                                  if (confirm('Da li ste sigurni da želite da obrišete ovaj termin?')) {
                                    setIsSubmitting(true)
                                    const res = await deleteAppointment(appt.id)
                                    if (res.success) {
                                      // Refresh appointments list
                                      const supabase = createClient()
                                      const { data } = await supabase.from('appointments').select('*').eq('patient_id', patient.id).order('appointment_datetime', { ascending: false })
                                      setAppointments(data || [])
                                    } else {
                                      alert(res.error || 'Greška pri brisanju.')
                                    }
                                    setIsSubmitting(false)
                                  }
                                }}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-650 hover:text-red-700 border border-red-100 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-55"
                                title="Obriši termin"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: NEW REPORT */}
          {activeTab === 'new_report' && (
            <form onSubmit={handleAddReport} className="max-w-4xl mx-auto pb-10">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <FileText className="text-[#0284C7]" /> Unos kliničkog izveštaja
                </h3>

                {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-150">{error}</div>}

                {/* DOCTOR SELECTION */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-slate-650 mb-2">Ordinirajući stomatolog *</label>
                  <div className="flex gap-3">
                    {['dr Slaviša Petković', 'dr Nebojša Kostić', 'dr Đurđina Grujić'].map((doc) => {
                      const active = selectedDoctor === doc
                      return (
                        <button
                          key={doc}
                          type="button"
                          onClick={() => setSelectedDoctor(doc)}
                          className={`flex-1 sm:flex-initial px-5 py-3 rounded-xl border text-sm font-semibold transition-all duration-200 cursor-pointer ${
                            active
                              ? 'bg-[#0284C7] text-white border-[#0284C7] shadow-sm'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
                          }`}
                        >
                          {doc}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* SERVICES CATALOG */}
                <div className="mb-8 space-y-6">
                  <label className="block text-xs font-semibold text-slate-650">Struktuirane Dentalne Usluge (Katalog)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {CATALOG_ZONES.map((zone) => (
                      <div key={zone.title} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                        <h4 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 pb-2 border-b border-slate-150">
                          {zone.title}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {zone.items.map((item) => {
                            const isSelected = selectedServices.includes(item.slug)
                            return (
                              <button
                                key={item.slug}
                                type="button"
                                onClick={() => toggleService(item.slug)}
                                className={`text-xs px-3 py-2 rounded-xl border font-semibold transition-all duration-200 cursor-pointer ${
                                  isSelected ? zone.activeColor : zone.color + ' hover:bg-white hover:border-slate-350 shadow-2xs'
                                }`}
                              >
                                {item.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DENTAL TEXT REPORT AREAS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="block text-xs font-semibold text-slate-650 mb-2">Anamneza</label>
                    <textarea name="anamneza" rows={3} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 text-sm" placeholder="Glavne tegobe i anamneza pacijenta..."></textarea>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-650 mb-2">Objektivni Nalaz</label>
                    <textarea name="nalaz" rows={3} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 text-sm" placeholder="Klinički status, status zuba, parodoncijuma..."></textarea>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-650 mb-2">Terapija (Dodatni Detalji)</label>
                    <textarea name="terapija" rows={3} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 text-sm" placeholder="Dodatna sprovedena intervencija, materijali..."></textarea>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-650 mb-2">Savet / Kontrola</label>
                    <textarea name="savet" rows={3} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 text-sm" placeholder="Uputstva pacijentu i zakazana kontrola..."></textarea>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-[#0284C7] mb-2">Plan Budućeg Lečenja</label>
                    <textarea name="future_treatment_plan" rows={2} className="w-full bg-sky-50/50 border border-sky-100 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-slate-900 placeholder-sky-500/40 outline-none transition-all duration-200 text-sm" placeholder="Planovi za sledeće posete pacijenta..."></textarea>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setActiveTab('history')} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer">Otkaži</button>
                  <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#0284C7] hover:bg-sky-600 text-white transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer">
                    <Save size={16} /> Sačuvaj izveštaj
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB: EDIT PATIENT */}
          {activeTab === 'edit_patient' && (
            <form onSubmit={handleEditPatient} className="max-w-3xl mx-auto pb-10">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Izmena osnovnih podataka</h3>

                {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-150">{error}</div>}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                  <div>
                    <label className="block text-xs font-semibold text-slate-650 mb-1.5">Ime *</label>
                    <input required name="first_name" defaultValue={patient.first_name} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-650 mb-1.5">Prezime</label>
                    <input name="last_name" defaultValue={patient.last_name || ''} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-650 mb-1.5">Telefon *</label>
                    <input required name="phone" defaultValue={patient.phone.startsWith('/') ? '/' : patient.phone} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-650 mb-1.5">Email</label>
                    <input name="email" type="email" defaultValue={patient.email || ''} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-650 mb-1.5">Kategorija pacijenta</label>
                    <select
                      name="category"
                      defaultValue={patient.category || 'regular'}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 text-sm"
                    >
                      <option value="regular">Regularni pacijent (Opšta stomatologija)</option>
                      <option value="implant">Implantologija</option>
                      <option value="proteza">Protetika / Proteze</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-650 mb-1.5">Ime roditelja</label>
                    <input name="parent_name" defaultValue={patient.parent_name || ''} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-red-600 mb-1.5">Medicinska upozorenja (Alergije, Bolesti)</label>
                    <textarea name="medical_alerts" defaultValue={patient.medical_alerts || ''} rows={2} className="w-full bg-red-50 border border-red-200 hover:border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-slate-900 placeholder-red-500/50 outline-none transition-all duration-200 text-sm" placeholder="Npr. Alergija na penicilin..."></textarea>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-650 mb-1.5">Interna napomena</label>
                    <textarea name="notes" defaultValue={patient.notes || ''} rows={2} className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all duration-200"></textarea>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-4 border-t border-slate-100">
                  {/* Delete button (with confirmation) */}
                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold bg-red-50 hover:bg-red-100 text-red-650 hover:text-red-705 border border-red-150 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                    >
                      Obriši pacijenta
                    </button>
                  ) : (
                    <div className="flex items-center justify-between sm:justify-start gap-2 bg-red-50 border border-red-150 rounded-xl p-2 px-3">
                      <span className="text-xs text-red-700 font-bold mr-2">Sigurno obrisati?</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDeletePatient}
                          disabled={isSubmitting}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Da
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-150 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        >
                          Ne
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#0284C7] hover:bg-sky-600 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                      <Save size={16} /> Sačuvaj izmene
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* TAB: DENTAL CHART */}
          {activeTab === 'dental_chart' && (
            <div className="max-w-4xl mx-auto pb-10">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Activity className="text-emerald-650" size={20} />
                  Dentalni Karton
                </h3>
                <p className="text-slate-600 text-sm">
                  Klikni na zub da promenish status. Promene se čuvaju automatski.
                </p>
              </div>
              <Suspense fallback={<div className="text-center py-16 text-slate-600 text-sm">Učitavanje dentalnog kartona...</div>}>
                <DentalChart patientId={patient.id} initialToothData={toothData} />
              </Suspense>
            </div>
          )}

          {/* TAB: X-RAY */}
          {activeTab === 'xrays' && (
            <div className="max-w-3xl mx-auto pb-10">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <ImageIcon className="text-violet-600" size={20} />
                  RTG Snimci i Ortopani
                </h3>
                <p className="text-slate-600 text-sm">
                  Prevucite snimke (PNG, JPEG, PDF) ili kliknite da ih uploadujete.
                </p>
              </div>
              <Suspense fallback={<div className="text-center py-16 text-slate-600 text-sm">Učitavanje...</div>}>
                <XRayUploader key={patient.id} patientId={patient.id} />
              </Suspense>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  )
}
