'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  Search, 
  UserPlus, 
  Plus, 
  Filter, 
  CalendarDays,
  User,
  Phone
} from 'lucide-react'
import { 
  deleteAppointment, 
  updateAppointment, 
  addAppointment, 
  addPatient 
} from '@/app/admin/actions'

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

interface TerminiClientProps {
  initialAppointments: Appointment[]
  patients: Patient[]
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; badge: string }> = {
  regular: { label: 'Regularni', color: 'text-slate-400', badge: 'bg-slate-800 text-slate-300' },
  implant: { label: 'Implant', color: 'text-sky-400', badge: 'bg-sky-500/10 text-sky-400 border border-sky-500/20' },
  proteza: { label: 'Protetika', color: 'text-violet-400', badge: 'bg-violet-500/10 text-violet-400 border border-violet-500/20' },
}

const DOCTORS = [
  'dr Slaviša Petković',
  'dr Nebojša Kostić',
  'dr Đurđina Grujić'
]

// Radno vreme klinike po danu (0=Nedelja, 1=Ponedeljak, ..., 6=Subota)
const CLINIC_HOURS: Record<number, { open: string; close: string } | null> = {
  0: null,                                // Nedelja — Zatvoreno
  1: { open: '10:00', close: '19:00' },   // Ponedeljak
  2: { open: '10:00', close: '19:00' },   // Utorak
  3: { open: '10:00', close: '19:00' },   // Sreda
  4: { open: '10:00', close: '19:00' },   // Četvrtak
  5: { open: '10:00', close: '19:00' },   // Petak
  6: { open: '10:00', close: '14:00' },   // Subota
}

function generateTimeSlots(open: string, close: string): string[] {
  const slots: string[] = []
  const [openH] = open.split(':').map(Number)
  const [closeH, closeM] = close.split(':').map(Number)
  const closeMins = closeH * 60 + closeM

  for (let h = openH; h <= closeH; h++) {
    for (let m = 0; m < 60; m += 15) {
      const totalMins = h * 60 + m
      if (totalMins >= closeMins) break
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots
}

function getTimeSlotsForDate(dateStr: string): string[] {
  if (!dateStr) return generateTimeSlots('10:00', '19:00') // fallback: radni dan
  const date = new Date(dateStr + 'T12:00:00')
  const day = date.getDay()
  const hours = CLINIC_HOURS[day]
  if (!hours) return [] // Zatvoreno
  return generateTimeSlots(hours.open, hours.close)
}

// Map doctors to visual colors as requested
export function getDoctorColor(doctorName: string | null | undefined) {
  if (!doctorName) return {
    bg: 'bg-slate-900/40 hover:bg-slate-900/60',
    border: 'border-white/5 hover:border-white/10',
    text: 'text-slate-400',
    badge: 'bg-slate-800 text-slate-400 border border-white/5',
    accent: 'slate'
  }
  const name = doctorName.toLowerCase()
  if (name.includes('slaviš') || name.includes('slavis')) {
    return {
      bg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
      border: 'border-emerald-500/20 hover:border-emerald-500/40',
      text: 'text-emerald-400',
      badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20',
      accent: 'emerald'
    }
  }
  if (name.includes('nebojš') || name.includes('nebojs')) {
    return {
      bg: 'bg-sky-500/5 hover:bg-sky-500/10',
      border: 'border-sky-500/20 hover:border-sky-500/40',
      text: 'text-sky-400',
      badge: 'bg-sky-500/15 text-sky-300 border border-sky-500/20',
      accent: 'sky'
    }
  }
  if (name.includes('elen') || name.includes('đurđ') || name.includes('djurdj')) {
    return {
      bg: 'bg-rose-500/5 hover:bg-rose-500/10',
      border: 'border-rose-500/20 hover:border-rose-500/40',
      text: 'text-rose-400',
      badge: 'bg-rose-500/15 text-rose-300 border border-rose-500/20',
      accent: 'rose'
    }
  }
  return {
    bg: 'bg-slate-900/40 hover:bg-slate-900/60',
    border: 'border-white/5 hover:border-white/10',
    text: 'text-slate-300',
    badge: 'bg-slate-800 text-slate-300 border border-white/5',
    accent: 'slate'
  }
}

// Format Belgrade Timezone ISO string safely
function formatTime(iso: string) {
  const d = new Date(iso)
  if (!iso || isNaN(d.getTime())) return '00:00'
  try {
    return new Intl.DateTimeFormat('sr-RS', {
      timeZone: 'Europe/Belgrade',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch (e) {
    return '00:00'
  }
}

function formatDateHeading(iso: string) {
  const d = new Date(iso)
  if (!iso || isNaN(d.getTime())) return 'Nevažeći datum'
  try {
    const formatted = new Intl.DateTimeFormat('sr-RS', {
      timeZone: 'Europe/Belgrade',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(d)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  } catch (e) {
    return 'Nevažeći datum'
  }
}

function getBelgradeDateKey(date: Date) {
  if (!date || isNaN(date.getTime())) return 'invalid-date'
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Belgrade',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch (e) {
    return 'invalid-date'
  }
}

export default function TerminiClient({
  initialAppointments,
  patients,
}: TerminiClientProps) {
  // Hydration Guard
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Local state for appointments and patients list to prevent page reloads
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments)
  const [patientsList, setPatientsList] = useState<Patient[]>(patients)

  // Navigation & View States
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly' | 'list'>('monthly')
  const [refDate, setRefDate] = useState<Date>(new Date())
  const [doctorFilter, setDoctorFilter] = useState<string>('all')

  // Appointment Action States
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null)
  const [editDatetime, setEditDatetime] = useState<string>('')
  const [editDate, setEditDate] = useState<string>('')
  const [editTime, setEditTime] = useState<string>('10:00')
  const [editDoctor, setEditDoctor] = useState<string>('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Booking Modal States
  const [isBookOpen, setIsBookOpen] = useState(false)
  const [bookDatetime, setBookDatetime] = useState('')
  const [bookDate, setBookDate] = useState<string>('')
  const [bookTime, setBookTime] = useState<string>('10:00')
  const [bookDoctor, setBookDoctor] = useState(DOCTORS[0])
  const [bookTreatment, setBookTreatment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Auto-synchronize date & time state to the main bookDatetime
  useEffect(() => {
    if (bookDate && bookTime) {
      setBookDatetime(`${bookDate}T${bookTime}`)
    }
  }, [bookDate, bookTime])

  // Auto-synchronize date & time state to the main editDatetime
  useEffect(() => {
    if (editDate && editTime) {
      setEditDatetime(`${editDate}T${editTime}`)
    }
  }, [editDate, editTime])

  // Auto-correct booking time when date changes and selected time is outside working hours
  useEffect(() => {
    const slots = getTimeSlotsForDate(bookDate)
    if (slots.length > 0 && !slots.includes(bookTime)) {
      setBookTime(slots[0])
    }
  }, [bookDate])

  // Auto-correct edit time when date changes
  useEffect(() => {
    const slots = getTimeSlotsForDate(editDate)
    if (slots.length > 0 && !slots.includes(editTime)) {
      setEditTime(slots[0])
    }
  }, [editDate])

  // Auto-dismiss success/error messages on the main page after 4 seconds
  useEffect(() => {
    if (successMsg || errorMsg) {
      const timer = setTimeout(() => {
        setSuccessMsg(null)
        setErrorMsg(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [successMsg, errorMsg])

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmId) {
          setDeleteConfirmId(null)
        } else if (isBookOpen) {
          setIsBookOpen(false)
        } else if (editingAppt) {
          setEditingAppt(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteConfirmId, isBookOpen, editingAppt])

  // Patient Selection States (Autocomplete)
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')
  const [newPhone, setNewPhone] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  // Patient Filter Search Query (Main Calendar View Filter)
  const [patientFilterQuery, setPatientFilterQuery] = useState('')

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    let list = appointments
    if (doctorFilter !== 'all') {
      list = list.filter(
        (appt) => appt.doctor_name && appt.doctor_name.toLowerCase().includes(doctorFilter.toLowerCase())
      )
    }
    if (patientFilterQuery.trim()) {
      const q = patientFilterQuery.toLowerCase().trim()
      list = list.filter((appt) => {
        if (!appt.patient) return false
        const firstName = appt.patient.first_name || ''
        const lastName = appt.patient.last_name || ''
        const fullName = `${firstName} ${lastName}`.toLowerCase()
        return fullName.includes(q)
      })
    }
    return list
  }, [appointments, doctorFilter, patientFilterQuery])

  // Autocomplete patient search list
  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return []
    const q = patientSearch.toLowerCase()
    return patientsList.filter(
      (p) => 
        (p.first_name && p.first_name.toLowerCase().includes(q)) || 
        (p.last_name && p.last_name.toLowerCase().includes(q)) ||
        (p.phone && p.phone.includes(q))
    ).slice(0, 5) // limit to top 5 results
  }, [patientsList, patientSearch])

  // Dynamic time slots based on selected day's clinic working hours
  const bookingTimeSlots = useMemo(() => getTimeSlotsForDate(bookDate), [bookDate])
  const editTimeSlots = useMemo(() => getTimeSlotsForDate(editDate), [editDate])

  // Hour Slots for Weekly Planner
  // Weekly planner rows: cover full weekday range (10:00–18:00 block = appointments up to 18:45)
  const hourSlots = useMemo(() => {
    const slots = []
    for (let h = 10; h <= 18; h++) {
      slots.push(String(h).padStart(2, '0') + ':00')
    }
    return slots
  }, [])

  // Days in selected week (Mon - Sun)
  const weekDays = useMemo(() => {
    const current = new Date(refDate)
    const day = current.getDay()
    const diff = current.getDate() - day + (day === 0 ? -6 : 1) // start on Monday
    const monday = new Date(current.setDate(diff))
    
    const days = []
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday)
      nextDay.setDate(monday.getDate() + i)
      days.push(nextDay)
    }
    return days
  }, [refDate])

  // Days in selected month (full 42 calendar grid cells)
  const monthDays = useMemo(() => {
    const year = refDate.getFullYear()
    const month = refDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const dayOfWeek = firstDay.getDay()
    const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const startDay = new Date(firstDay)
    startDay.setDate(startDay.getDate() - diffToMon)
    
    const grid = []
    const current = new Date(startDay)
    for (let i = 0; i < 42; i++) {
      grid.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return grid
  }, [refDate])

  // Format month and year header (e.g. Maj 2026)
  const monthLabel = useMemo(() => {
    const formatted = new Intl.DateTimeFormat('sr-RS', {
      month: 'long',
      year: 'numeric',
    }).format(refDate)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }, [refDate])

  // Original list groupings from today onwards
  const listGroupedKeys = useMemo(() => {
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)
    
    const upcoming = filteredAppointments.filter(
      appt => new Date(appt.appointment_datetime) >= todayMidnight
    )

    const grouped = upcoming.reduce<Record<string, Appointment[]>>((acc, appt) => {
      const key = getBelgradeDateKey(new Date(appt.appointment_datetime))
      if (!acc[key]) acc[key] = []
      acc[key].push(appt)
      return acc
    }, {})

    return Object.keys(grouped).sort()
  }, [filteredAppointments])

  // Helper: map appointments by Belgrade date string
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    filteredAppointments.forEach((appt) => {
      const key = getBelgradeDateKey(new Date(appt.appointment_datetime))
      if (!map[key]) map[key] = []
      map[key].push(appt)
    })
    // Sort each day's appointments by time (earliest first), then by doctor name for same-time slots
    Object.values(map).forEach(dayAppts => {
      dayAppts.sort((a, b) => {
        const timeA = new Date(a.appointment_datetime).getTime()
        const timeB = new Date(b.appointment_datetime).getTime()
        if (timeA !== timeB) return timeA - timeB
        // Same time → sort by doctor name so they appear grouped together
        return (a.doctor_name || '').localeCompare(b.doctor_name || '')
      })
    })
    return map
  }, [filteredAppointments])

  // Navigation handlers
  const handleToday = () => setRefDate(new Date())
  const handlePrev = () => {
    const next = new Date(refDate)
    if (viewMode === 'weekly') {
      next.setDate(next.getDate() - 7)
    } else {
      next.setMonth(next.getMonth() - 1)
    }
    setRefDate(next)
  }
  const handleNext = () => {
    const next = new Date(refDate)
    if (viewMode === 'weekly') {
      next.setDate(next.getDate() + 7)
    } else {
      next.setMonth(next.getMonth() + 1)
    }
    setRefDate(next)
  }

  // Open booking modal prefilled
  const openBooking = (date: Date, hourStr?: string) => {
    const dt = new Date(date)
    if (hourStr) {
      const [h, m] = hourStr.split(':')
      dt.setHours(Number(h), Number(m), 0, 0)
    } else {
      dt.setHours(10, 0, 0, 0) // default: clinic opening
    }
    
    // Format to local ISO (YYYY-MM-DDTHH:mm)
    const y = dt.getFullYear()
    const mo = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    const h = String(dt.getHours()).padStart(2, '0')
    const mi = String(dt.getMinutes()).padStart(2, '0')
    
    setBookDate(`${y}-${mo}-${d}`)
    setBookTime(`${h}:${mi}`)
    setBookDatetime(`${y}-${mo}-${d}T${h}:${mi}`)
    setErrorMsg(null)
    setSuccessMsg(null)
    setSelectedPatientId('')
    setPatientSearch('')
    setNewPhone('')
    setBookTreatment('')
    setShowDropdown(false)
    setIsBookOpen(true)
  }

  // Handle Quick Booking Submit
  const handleBookSubmit = async () => {
    if (!bookDatetime) {
      setErrorMsg('Datum i vreme su obavezni.')
      return
    }

    let patientId = selectedPatientId
    let newPatientObj: Patient | null = null

    setIsSubmitting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      // 1. If brand-new patient is requested, create them first
      const isNew = !selectedPatientId
      if (isNew) {
        if (!patientSearch.trim()) {
          setErrorMsg('Ime pacijenta je obavezno.')
          setIsSubmitting(false)
          return
        }

        const nameParts = patientSearch.trim().split(/\s+/)
        const firstName = nameParts[0]
        const lastName = nameParts.slice(1).join(' ') || ''

        const patFormData = new FormData()
        patFormData.append('first_name', firstName)
        patFormData.append('last_name', lastName)
        patFormData.append('phone', newPhone.trim())
        patFormData.append('category', 'regular')
        
        const patRes = await addPatient(null, patFormData)
        if (!patRes.success) {
          setErrorMsg(patRes.error || 'Greška pri kreiranju novog pacijenta.')
          setIsSubmitting(false)
          return
        }

        // Use the patient ID returned by addPatient
        if (!patRes.id) {
          setErrorMsg('Pacijent je kreiran ali ID nije vraćen. Pokušajte ponovo.')
          setIsSubmitting(false)
          return
        }
        patientId = patRes.id

        newPatientObj = {
          id: patientId,
          first_name: firstName,
          last_name: lastName,
          phone: newPhone.trim() || `/-no-phone-${Math.random().toString(36).substring(2, 10)}`,
          category: 'regular'
        }
      }

      // 2. Add appointment
      const apptFormData = new FormData()
      apptFormData.append('patient_id', patientId)
      apptFormData.append('appointment_datetime', bookDatetime)
      apptFormData.append('doctor_name', bookDoctor)
      apptFormData.append('treatment_today', bookTreatment)

      const apptRes = await addAppointment(null, apptFormData)
      if (apptRes.success) {
        setSuccessMsg('Termin uspešno rezervisan!')

        const patientInfo = newPatientObj || patientsList.find(p => p.id === patientId) || {
          id: patientId,
          first_name: patientSearch,
          last_name: '',
          phone: newPhone || '/',
          category: 'regular'
        }

        const newAppt: Appointment = {
          id: apptRes.id || `temp-${Date.now()}`,
          appointment_datetime: new Date(bookDatetime).toISOString(),
          doctor_name: bookDoctor,
          treatment_today: bookTreatment || null,
          reminder_sent: false,
          patient: patientInfo
        }

        if (newPatientObj) {
          setPatientsList(prev => [...prev, newPatientObj!])
        }
        setAppointments(prev => [...prev, newAppt])

        setTimeout(() => {
          setIsBookOpen(false)
          setSuccessMsg(null)
        }, 400)
      } else {
        setErrorMsg(apptRes.error || 'Greška pri zakazivanju termina.')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Došlo je do greške.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Open Edit Dialog
  const handleEditClick = (appt: Appointment) => {
    const dt = new Date(appt.appointment_datetime)
    const y = dt.getFullYear()
    const mo = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    const h = String(dt.getHours()).padStart(2, '0')
    const mi = String(dt.getMinutes()).padStart(2, '0')

    setEditDate(`${y}-${mo}-${d}`)
    setEditTime(`${h}:${mi}`)
    setEditDatetime(`${y}-${mo}-${d}T${h}:${mi}`)
    setEditDoctor(appt.doctor_name || DOCTORS[0])
    setEditingAppt(appt)
    setErrorMsg(null)
    setSuccessMsg(null)
  }

  // Save edit changes
  const handleSaveEdit = async () => {
    if (!editDatetime) return
    setIsSubmitting(true)
    const res = await updateAppointment(editingAppt!.id, editDatetime, editDoctor)
    setIsSubmitting(false)
    if (res.success) {
      setSuccessMsg('Termin uspešno izmenjen!')

      // Update local state
      setAppointments(prev => prev.map(appt => {
        if (appt.id === editingAppt!.id) {
          const formattedIso = new Date(editDatetime).toISOString()
          return {
            ...appt,
            appointment_datetime: formattedIso,
            doctor_name: editDoctor
          }
        }
        return appt
      }))

      setTimeout(() => {
        setEditingAppt(null)
        setSuccessMsg(null)
      }, 400)
    } else {
      setErrorMsg(res.error || 'Greška pri izmeni.')
    }
  }

  // Save delete changes
  const handleDelete = async (apptId: string) => {
    setIsSubmitting(true)
    const res = await deleteAppointment(apptId)
    setIsSubmitting(false)
    if (res.success) {
      setSuccessMsg('Termin uspešno obrisan!')

      // Update local state
      setAppointments(prev => prev.filter(appt => appt.id !== apptId))

      // Close delete confirmation modal immediately to display status inside the editing modal if open
      setDeleteConfirmId(null)

      if (editingAppt) {
        setTimeout(() => {
          setEditingAppt(null)
          setSuccessMsg(null)
        }, 400)
      }
    } else {
      setErrorMsg(res.error || 'Greška pri brisanju.')
    }
  }

  // Check if today matches a Date
  const isToday = (date: Date) => {
    const today = new Date()
    return getBelgradeDateKey(today) === getBelgradeDateKey(date)
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 pt-20 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-slate-400 font-bold text-lg animate-pulse">Učitavanje planera...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 pt-20 sm:p-6 lg:p-8">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-admin-sidebar'))}
            className="group flex items-center gap-3 bg-slate-900 hover:bg-slate-800 border border-white/5 hover:border-white/10 rounded-2xl px-4 py-2 transition-all cursor-pointer shadow-md"
            title="Otvori meni"
          >
            <div className="relative w-8 h-8 flex items-center justify-center">
              <img
                src="/logo-spdent.png"
                alt="SP DENT Logo"
                className="w-full h-full object-contain brightness-0 invert group-hover:scale-105 transition-transform"
              />
            </div>
            <span className="text-white font-black text-lg tracking-wide hidden sm:inline-block">SP DENT</span>
          </button>
          
          <div className="h-6 w-px bg-white/15 mx-1" />
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <CalendarDays className="text-sky-400" size={16} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Planer</h1>
          </div>
        </div>
      </div>

      {/* Page-level Alerts */}
      <AnimatePresence>
        {successMsg && !isBookOpen && !editingAppt && !deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-sm font-bold flex items-center justify-between gap-3 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span>{successMsg}</span>
            </div>
            <button 
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-400 hover:text-emerald-300 font-bold text-xs cursor-pointer"
            >
              U redu
            </button>
          </motion.div>
        )}
        {errorMsg && !isBookOpen && !editingAppt && !deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm font-bold flex items-center justify-between gap-3 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
            <button 
              onClick={() => setErrorMsg(null)}
              className="text-rose-400 hover:text-rose-300 font-bold text-xs cursor-pointer"
            >
              U redu
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Toolbar */}
      <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 mb-6 flex flex-col gap-5">
        {/* Row 1: Navigation & View Mode Buttons */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/5 pb-4">
          {/* Navigation & Date Label */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-white/10 rounded-xl p-1">
              <button
                onClick={handlePrev}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                title="Prethodno"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={handleToday}
                className="px-3.5 py-1.5 text-xs text-white font-bold bg-slate-900 border border-white/5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Danas
              </button>
              <button
                onClick={handleNext}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                title="Sledeće"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              {viewMode === 'weekly' ? (
                `Nedelja: ${weekDays[0].getDate()}. ${new Intl.DateTimeFormat('sr-RS', { month: 'short' }).format(weekDays[0])} - ${weekDays[6].getDate()}. ${new Intl.DateTimeFormat('sr-RS', { month: 'short', year: 'numeric' }).format(weekDays[6])}`
              ) : (
                monthLabel
              )}
            </h2>
          </div>

          {/* View Mode Buttons */}
          <div className="flex items-center bg-slate-950 border border-white/10 rounded-xl p-1 self-end md:self-auto">
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'weekly' ? 'bg-sky-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Nedeljni
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'monthly' ? 'bg-sky-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mesečni
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-sky-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Lista
            </button>
          </div>
        </div>

        {/* Row 2: Search Patient & Doctor Selection */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Patient Search Input */}
          <div className="md:col-span-5 flex flex-col gap-1.5">
            <label htmlFor="appt-patient-filter-input" className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
              Pretraži pacijenta
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                id="appt-patient-filter-input"
                type="text"
                value={patientFilterQuery}
                onChange={(e) => setPatientFilterQuery(e.target.value)}
                placeholder="Unesite ime i prezime pacijenta..."
                className="w-full bg-slate-950 border border-white/10 hover:border-white/20 focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200"
              />
              {patientFilterQuery && (
                <button
                  onClick={() => setPatientFilterQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
                  title="Očisti pretragu"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Doctor Selection Pills */}
          <div className="md:col-span-7 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
              Filtriraj po lekaru
            </label>
            <div className="flex items-center gap-2 bg-slate-950 border border-white/10 rounded-xl p-1 overflow-x-auto max-w-full">
              <button
                onClick={() => setDoctorFilter('all')}
                className={`px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  doctorFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Svi lekari
              </button>
              {DOCTORS.map((doc) => {
                const info = getDoctorColor(doc)
                const active = doctorFilter === doc
                return (
                  <button
                    key={doc}
                    onClick={() => setDoctorFilter(doc)}
                    className={`px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      active
                        ? `${info.badge} shadow-md`
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      info.accent === 'emerald' ? 'bg-emerald-400' :
                      info.accent === 'sky' ? 'bg-sky-400' :
                      info.accent === 'rose' ? 'bg-rose-400' : 'bg-slate-400'
                    }`} />
                    {doc?.split(' ')?.[1] || doc}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Views Container */}
      <div className="bg-slate-900/30 border border-white/5 rounded-3xl p-2 sm:p-4 min-h-[500px]">
        {/* VIEW 1: WEEKLY HOURLY PLANNER */}
        {viewMode === 'weekly' && (
          <div className="overflow-x-auto premium-scrollbar">
            <div className="min-w-[900px] grid grid-cols-8 border-b border-white/5 pb-2">
              {/* Corner */}
              <div className="p-3 text-slate-500 text-xs font-semibold text-center border-r border-white/5">
                Vreme
              </div>
              {/* Days Header */}
              {weekDays.map((day) => {
                const today = isToday(day)
                return (
                  <div 
                    key={day.toISOString()} 
                    className={`p-3 text-center border-r border-white/5 last:border-0 ${
                      today ? 'bg-sky-500/10 rounded-2xl border border-sky-500/20 shadow-lg shadow-sky-500/5' : ''
                    }`}
                  >
                    <p className={`text-xs font-black uppercase tracking-wider ${today ? 'text-sky-400' : 'text-slate-300'}`}>
                      {new Intl.DateTimeFormat('sr-RS', { weekday: 'short' }).format(day)}
                    </p>
                    <p className={`text-xl font-black mt-0.5 ${today ? 'text-sky-400' : 'text-white'}`}>
                      {day.getDate()}. {new Intl.DateTimeFormat('sr-RS', { month: 'short' }).format(day)}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Hours Grid */}
            <div className="min-w-[900px]">
              {hourSlots.map((hour) => (
                <div key={hour} className="grid grid-cols-8 border-b border-white/5 last:border-0 min-h-[76px] items-stretch">
                  {/* Hour display */}
                  <div className="flex items-center justify-center p-3 text-sm font-black text-slate-400 bg-slate-950/20 border-r border-white/5">
                    {hour}
                  </div>

                  {/* Daily cells for this hour */}
                  {weekDays.map((day) => {
                    const dateKey = getBelgradeDateKey(day)
                    const dayAppts = appointmentsByDate[dateKey] || []
                    
                    // Filter appointments belonging to this hour slot (e.g. "08:30" goes to "08:00")
                    const cellAppts = dayAppts.filter((appt) => {
                      const timeStr = formatTime(appt.appointment_datetime)
                      return timeStr.startsWith(hour.split(':')[0])
                    })

                    // Check if this cell is outside clinic working hours
                    const dayOfWeek = day.getDay()
                    const clinicHrs = CLINIC_HOURS[dayOfWeek]
                    const hourNum = parseInt(hour.split(':')[0])
                    const isOutsideHours = !clinicHrs || hourNum >= parseInt(clinicHrs.close) || hourNum < parseInt(clinicHrs.open)

                    return (
                      <div 
                        key={day.toISOString() + '-' + hour} 
                        onClick={() => !isOutsideHours && openBooking(day, hour)}
                        className={`p-1 border-r border-white/5 last:border-0 min-h-[76px] transition-colors relative flex flex-col gap-1 justify-center ${
                          isOutsideHours 
                            ? 'bg-slate-950/60 opacity-30 cursor-default' 
                            : 'hover:bg-slate-900/40 cursor-pointer group'
                        }`}
                      >
                        {cellAppts.map((appt) => {
                          const docColor = getDoctorColor(appt.doctor_name)
                          return (
                            <div
                              key={appt.id}
                              onClick={(e) => {
                                e.stopPropagation() // prevent booking trigger
                                handleEditClick(appt)
                              }}
                              className={`p-2 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between h-full ${docColor.bg} ${docColor.border}`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className={`text-[10px] font-black uppercase tracking-wider ${docColor.text}`}>
                                  {formatTime(appt.appointment_datetime)} h
                                </span>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${docColor.badge}`}>
                                  {appt.doctor_name?.split(' ')?.[1] || 'Zubar'}
                                </span>
                              </div>
                              <p className="text-white text-xs font-black truncate mt-1 leading-tight">
                                {appt.patient?.first_name} {appt.patient?.last_name || ''}
                              </p>
                              {appt.treatment_today && (
                                <p className="text-slate-400 text-[10px] truncate mt-0.5 leading-tight font-medium">
                                  {appt.treatment_today}
                                </p>
                              )}
                            </div>
                          )
                        })}

                        {/* Plus hover sign */}
                        {cellAppts.length === 0 && !isOutsideHours && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-7 h-7 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
                              <Plus className="text-sky-400" size={14} />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 2: MONTHLY GRID */}
        {viewMode === 'monthly' && (
          <div>
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 border-b border-white/5 pb-2 text-center">
              {['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'].map((day) => (
                <div key={day} className="p-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid cells */}
            <div className="grid grid-cols-7 gap-1 mt-1">
              {monthDays.map((day) => {
                const dateKey = getBelgradeDateKey(day)
                const dayAppts = appointmentsByDate[dateKey] || []
                const isCurrentMonth = day.getMonth() === refDate.getMonth()
                const today = isToday(day)

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => openBooking(day)}
                    className={`min-h-[120px] h-auto p-2 border border-white/5 rounded-2xl flex flex-col gap-1.5 hover:bg-slate-900/40 transition-colors cursor-pointer relative group ${
                      isCurrentMonth ? 'bg-slate-900/10' : 'bg-slate-950/40 opacity-40'
                    } ${today ? 'bg-sky-500/10 border border-sky-500/20 shadow-lg shadow-sky-500/5' : ''}`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-1">
                      <span className={`text-base font-black ${
                        today ? 'text-sky-400 font-extrabold' : 
                        isCurrentMonth ? 'text-white' : 'text-slate-500'
                      }`}>
                        {day.getDate()}
                      </span>
                      {dayAppts.length > 0 && (
                        <span className="text-[10px] text-slate-400 font-bold bg-slate-950 px-1.5 py-0.5 rounded-md">
                          {dayAppts.length}
                        </span>
                      )}
                    </div>

                    {/* Day appointments list: Dynamic height, no scrollbars */}
                    <div className="flex-1 flex flex-col gap-1.5 pt-0.5 select-none pb-4">
                      {dayAppts.map((appt) => {
                        const isSlavisa = appt.doctor_name?.toLowerCase().includes('slaviš') || appt.doctor_name?.toLowerCase().includes('slavis')
                        const isNebojsa = appt.doctor_name?.toLowerCase().includes('nebojš') || appt.doctor_name?.toLowerCase().includes('nebojs')
                        const isDjurdjina = appt.doctor_name?.toLowerCase().includes('đurđ') || appt.doctor_name?.toLowerCase().includes('djurdj')

                        let customCardClasses = 'bg-slate-800/40 border-white/10 text-slate-300'
                        if (isSlavisa) {
                          customCardClasses = 'bg-emerald-500/25 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/35 hover:border-emerald-500/80'
                        } else if (isNebojsa) {
                          customCardClasses = 'bg-sky-500/25 border-sky-500/60 text-sky-200 hover:bg-sky-500/35 hover:border-sky-500/80'
                        } else if (isDjurdjina) {
                          customCardClasses = 'bg-rose-500/25 border-rose-500/60 text-rose-200 hover:bg-rose-500/35 hover:border-rose-500/80'
                        }

                        return (
                          <div
                            key={appt.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditClick(appt)
                            }}
                            className={`px-2 py-1 rounded-xl border text-[11px] font-black leading-tight flex items-center gap-1.5 hover:scale-[1.02] transition-all cursor-pointer ${customCardClasses}`}
                          >
                            <span className="shrink-0 font-black px-1.5 py-0.5 bg-slate-950/60 rounded text-[9px] text-white">
                              {formatTime(appt.appointment_datetime)}
                            </span>
                            <span className="text-white truncate font-black">
                              {appt.patient?.first_name} {appt.patient?.last_name || ''}
                            </span>
                            <span className="text-slate-200 font-bold shrink-0 ml-auto text-[9px] opacity-90">
                              {appt.doctor_name?.split(' ')?.[1] || 'Zubar'}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Plus hover sign */}
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-5 h-5 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
                        <Plus className="text-sky-400" size={10} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* VIEW 3: HRONOLOŠKA LISTA (List view) */}
        {viewMode === 'list' && (
          <div className="max-w-2xl mx-auto py-4">
            {listGroupedKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <CalendarIcon size={44} className="text-slate-700 mb-4" />
                <p className="text-slate-400 font-bold text-lg">Nema zakazanih termina</p>
                <p className="text-slate-600 text-sm mt-1">Nema predstojećih termina za izabranog lekara</p>
              </div>
            ) : (
              <div className="space-y-8">
                {listGroupedKeys.map((dateKey) => {
                  const dayAppts = appointmentsByDate[dateKey] || []
                  const dt = new Date(dayAppts[0].appointment_datetime)
                  const today = isToday(dt)

                  return (
                    <div key={dateKey} className="group/day">
                      {/* Day heading: Clean, no borders, text-only as requested */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                          today
                            ? 'bg-sky-500/15 text-sky-400'
                            : 'bg-slate-900 text-slate-400'
                        }`}>
                          {today ? '🗓 Danas' : formatDateHeading(dayAppts[0].appointment_datetime)}
                        </div>
                        <div className="flex-1 h-px bg-white/5" />
                        <span className="text-slate-600 text-xs font-bold">{dayAppts.length} termin{dayAppts.length !== 1 ? 'a' : ''}</span>
                      </div>

                      {/* Appointments List: Clean, borderless, text only, no backgrounds */}
                      <div className="space-y-3.5">
                        {dayAppts.map((appt) => {
                          const docColor = getDoctorColor(appt.doctor_name)
                          const catInfo = CATEGORY_LABELS[appt.patient?.category ?? 'regular']
                          
                          return (
                            <div 
                              key={appt.id}
                              className="flex items-start gap-4 py-2 hover:bg-white/2 rounded-xl px-2 transition-colors relative"
                            >
                              {/* Time display */}
                              <div className="shrink-0 w-16 text-center pt-0.5">
                                <div className="text-lg font-black text-sky-400">
                                  {formatTime(appt.appointment_datetime)}
                                </div>
                                <div className="text-slate-600 text-[10px] font-bold">Belgrade h</div>
                              </div>

                              {/* Divider */}
                              <div className="w-px self-stretch bg-white/5" />

                              {/* Details: Borderless, clean */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-white text-base font-extrabold leading-tight">
                                      {appt.patient?.first_name} {appt.patient?.last_name || ''}
                                    </p>
                                    <p className="text-slate-500 text-xs mt-0.5 font-bold font-mono">
                                      {appt.patient?.phone?.startsWith('/') ? '/' : appt.patient?.phone}
                                    </p>
                                  </div>
                                  
                                  <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                                    {/* Patient Category and Doctor badges */}
                                    <div className="flex items-center gap-1.5">
                                      {catInfo && (
                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${catInfo.badge}`}>
                                          {catInfo.label}
                                        </span>
                                      )}
                                      {appt.doctor_name && (
                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${docColor.badge}`}>
                                          {appt.doctor_name}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {appt.reminder_sent && (
                                      <span className="text-[10px] text-emerald-400 font-extrabold">
                                        ✓ SMS Poslat
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {appt.treatment_today && (
                                  <p className="text-slate-400 text-xs mt-1.5 font-medium flex items-center gap-1">
                                    <Clock size={12} className="text-slate-600" />
                                    {appt.treatment_today}
                                  </p>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3 mt-2">
                                  <button
                                    onClick={() => handleEditClick(appt)}
                                    className="text-xs text-sky-400 hover:text-sky-300 font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  >
                                    <Edit2 size={11} />
                                    Izmeni
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(appt.id)}
                                    className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  >
                                    <Trash2 size={11} />
                                    Obriši
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: QUICK BOOKING MODAL (1-2 Clicks) */}
      <AnimatePresence>
        {isBookOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBookOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            />
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div 
                data-lenis-prevent
                className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl shadow-black/80 max-h-[90vh] overflow-y-auto premium-scrollbar"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                      <UserPlus size={18} className="text-sky-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-extrabold text-lg">Brzo zakazivanje</h2>
                      <p className="text-slate-400 text-xs">Popunite podatke u 1-2 klika</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsBookOpen(false)}
                    className="p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-white border border-white/5 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Form Body */}
                <div className="p-6 space-y-5">
                  {successMsg && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm font-bold flex items-center gap-2">
                      <span>✅</span> {successMsg}
                    </div>
                  )}

                  {errorMsg && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm font-bold flex items-center gap-2">
                      <span>⚠️</span> {errorMsg}
                    </div>
                  )}

                  {/* Unified Patient Search & Input */}
                  <div className="space-y-4">
                    <div className="relative">
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                        Pacijent (Ime i prezime) *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={patientSearch}
                          onChange={(e) => {
                            setPatientSearch(e.target.value)
                            setSelectedPatientId('')
                            setNewPhone('')
                            setShowDropdown(true)
                          }}
                          onFocus={() => setShowDropdown(true)}
                          onClick={() => setShowDropdown(true)}
                          placeholder="Unesite ime pacijenta (npr. Marko Marković)..."
                          className={`w-full bg-slate-950 border hover:border-white/20 focus:border-sky-500/50 rounded-2xl pl-11 pr-10 py-3.5 text-white outline-none text-base font-bold placeholder-slate-600 transition-colors ${
                            selectedPatientId ? 'border-emerald-500/50 focus:border-emerald-500/50' : 'border-white/10'
                          }`}
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                        {patientSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPatientId('')
                              setPatientSearch('')
                              setNewPhone('')
                              setShowDropdown(false)
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>

                      {/* Autocomplete dropdown with click outside overlay */}
                      {filteredPatients.length > 0 && !selectedPatientId && showDropdown && (
                        <>
                          <div 
                            className="fixed inset-0 z-20 cursor-default"
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowDropdown(false)
                            }}
                          />
                          <div className="absolute z-30 w-full mt-2 bg-slate-950 border border-white/10 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden divide-y divide-white/5 max-h-60 overflow-y-auto premium-scrollbar">
                            {filteredPatients.map((p) => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setSelectedPatientId(p.id)
                                  setPatientSearch(`${p.first_name} ${p.last_name || ''}`)
                                  setNewPhone(p.phone)
                                  setShowDropdown(false)
                                }}
                                className="px-4 py-3.5 hover:bg-slate-900 cursor-pointer flex items-center justify-between gap-3 transition-colors relative z-30"
                              >
                                <div>
                                  <p className="text-white font-extrabold text-sm">{p.first_name} {p.last_name || ''}</p>
                                  <p className="text-slate-500 text-xs font-mono font-bold mt-0.5">
                                    {p.phone?.startsWith('/') ? '/' : p.phone}
                                  </p>
                                </div>
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                  p.category === 'implant' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                                  p.category === 'proteza' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {CATEGORY_LABELS[p.category]?.label || 'Regularni'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Conditional rendering for Phone Number based on selection */}
                    <AnimatePresence initial={false}>
                      {!selectedPatientId && patientSearch.trim() !== '' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-1.5 pt-1">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                              Broj telefona novog pacijenta * (ili '/' ako nema telefon)
                            </label>
                            <input
                              type="text"
                              value={newPhone}
                              onChange={(e) => setNewPhone(e.target.value)}
                              placeholder="npr. +3816..."
                              className="w-full bg-slate-950 border border-white/10 hover:border-white/20 focus:border-sky-500/50 rounded-2xl px-4 py-3.5 text-white outline-none text-base font-bold placeholder-slate-600 transition-colors"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {selectedPatientId && (
                      <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold bg-emerald-500/10 border border-emerald-500/20 px-4 py-3.5 rounded-2xl">
                        <Check size={16} />
                        <span>Izabran postojeći pacijent. Telefon: <strong>{newPhone?.startsWith('/') ? '/' : newPhone || '/'}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Standard Appointment Parameters */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Datum *</label>
                      <input
                        type="date"
                        value={bookDate}
                        onChange={(e) => setBookDate(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold outline-none focus:border-sky-500 text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Vreme *</label>
                      {bookingTimeSlots.length === 0 ? (
                        <div className="w-full bg-red-950/50 border border-red-500/20 rounded-2xl px-4 py-3.5 text-red-400 font-bold text-sm text-center">
                          Klinika ne radi tog dana
                        </div>
                      ) : (
                        <select
                          value={bookTime}
                          onChange={(e) => setBookTime(e.target.value)}
                          className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold outline-none focus:border-sky-500 text-base"
                        >
                          {bookingTimeSlots.map((time) => (
                            <option key={time} value={time}>
                              {time} h
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Lekar *</label>
                      <select
                        value={bookDoctor}
                        onChange={(e) => setBookDoctor(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold outline-none focus:border-sky-500 text-base"
                      >
                        {DOCTORS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Planirana intervencija</label>
                    <textarea
                      value={bookTreatment}
                      onChange={(e) => setBookTreatment(e.target.value)}
                      placeholder="npr. Kontrola, popravka, brušenje..."
                      rows={2}
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold outline-none focus:border-sky-500 placeholder-slate-600 text-base resize-none"
                    />
                  </div>

                  {/* Booking Submit Actions */}
                  <div className="flex gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setIsBookOpen(false)}
                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-sm font-bold transition-colors cursor-pointer"
                    >
                      Otkaži
                    </button>
                    <button
                      type="button"
                      onClick={handleBookSubmit}
                      disabled={isSubmitting || (!selectedPatientId && !patientSearch.trim()) || bookingTimeSlots.length === 0}
                      className="flex-1 py-3 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white rounded-2xl text-sm font-extrabold shadow-lg shadow-sky-500/10 cursor-pointer disabled:cursor-not-allowed transition-all"
                    >
                      {isSubmitting ? 'Zakazivanje...' : 'Zakaži Termin'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL 2: APPOINTMENT OPTIONS / EDIT DIALOG */}
      <AnimatePresence>
        {editingAppt && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingAppt(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-black/80 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <div>
                    <h3 className="text-white font-extrabold text-base">Upravljanje terminom</h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Pacijent: <span className="text-white font-bold">{editingAppt.patient?.first_name} {editingAppt.patient?.last_name || ''}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingAppt(null)}
                    className="p-1.5 rounded-lg bg-slate-950 border border-white/5 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {successMsg && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold">
                    {successMsg}
                  </div>
                )}
                {errorMsg && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Datum</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white font-bold text-sm outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Vreme</label>
                      {editTimeSlots.length === 0 ? (
                        <div className="w-full bg-red-950/50 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-400 font-bold text-sm text-center">
                          Zatvoreno
                        </div>
                      ) : (
                        <select
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white font-bold text-sm outline-none focus:border-sky-500"
                        >
                          {editTimeSlots.map((time) => (
                            <option key={time} value={time}>
                              {time} h
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Lekar</label>
                    <select
                      value={editDoctor}
                      onChange={(e) => setEditDoctor(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white font-bold text-sm outline-none focus:border-sky-500"
                    >
                      {DOCTORS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Sačuvaj izmene
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(editingAppt.id)}
                    disabled={isSubmitting}
                    className="py-2.5 px-4 bg-red-950 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Obriši termin
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CONFIRMATION DIALOG: DELETE CONFIRM */}
      <AnimatePresence>
        {deleteConfirmId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="w-full max-w-sm bg-slate-900 border border-red-500/20 rounded-3xl p-6 shadow-2xl shadow-black/80 pointer-events-auto space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400 text-xl font-bold">
                  ⚠️
                </div>
                <h4 className="text-white font-extrabold text-base">Brisanje termina</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Da li ste sigurni da želite trajno obrisati ovaj termin? Ova akcija je nepovratna i SMS podsetnik neće biti poslat.
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleDelete(deleteConfirmId)}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Obriši trajno
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Otkaži
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
