'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Edit2, Trash2, X, Check } from 'lucide-react'
import { deleteAppointment, updateAppointment } from '@/app/admin/actions'

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
  appointments: Appointment[]
  dateKey: string
  today: boolean
  CATEGORY_LABELS: Record<string, { label: string; color: string }>
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('sr-RS', {
    timeZone: 'Europe/Belgrade',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export default function TerminiClient({
  appointments,
  dateKey,
  today,
  CATEGORY_LABELS,
}: TerminiClientProps) {
  const [editingApptId, setEditingApptId] = useState<string | null>(null)
  const [editDatetime, setEditDatetime] = useState<string>('')
  const [editDoctor, setEditDoctor] = useState<string>('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleEditClick = (appt: Appointment) => {
    // Convert datetime to HTML datetime-local format (YYYY-MM-DDTHH:mm)
    const dt = new Date(appt.appointment_datetime)
    const year = dt.getUTCFullYear()
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const day = String(dt.getUTCDate()).padStart(2, '0')
    const hours = String(dt.getUTCHours()).padStart(2, '0')
    const minutes = String(dt.getUTCMinutes()).padStart(2, '0')
    
    setEditDatetime(`${year}-${month}-${day}T${hours}:${minutes}`)
    setEditDoctor(appt.doctor_name || 'dr Slaviša Petković')
    setEditingApptId(appt.id)
    setError(null)
    setSuccessMsg(null)
  }

  const handleSaveEdit = async () => {
    if (!editDatetime) {
      setError('Datum i vreme su obavezni.')
      return
    }

    setIsSubmitting(true)
    const result = await updateAppointment(editingApptId!, editDatetime, editDoctor)
    setIsSubmitting(false)

    if (result.success) {
      setSuccessMsg('Termin je uspešno azuriran!')
      setEditingApptId(null)
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } else {
      setError(result.error || 'Greška pri ažuriranju termina.')
    }
  }

  const handleDelete = async (apptId: string) => {
    setIsSubmitting(true)
    const result = await deleteAppointment(apptId)
    setIsSubmitting(false)

    if (result.success) {
      setSuccessMsg('Termin je obrisan!')
      setDeleteConfirmId(null)
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } else {
      setError(result.error || 'Greška pri brisanju termina.')
    }
  }

  return (
    <div className="space-y-3 relative">
      <AnimatePresence mode="popLayout">
        {appointments.map((appt) => {
          const catInfo = CATEGORY_LABELS[appt.patient?.category ?? 'regular']
          const isPast = new Date(appt.appointment_datetime) < new Date()
          const isEditing = editingApptId === appt.id

          return (
            <motion.div
              key={appt.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-all relative ${
                isPast
                  ? 'bg-slate-900/30 border-white/5 opacity-60'
                  : 'bg-slate-900/70 border-white/10 hover:border-white/20'
              }`}
            >
              {/* Time column */}
              <div className="shrink-0 w-16 text-center">
                <div className={`text-xl font-bold ${isPast ? 'text-slate-500' : 'text-sky-400'}`}>
                  {formatTime(appt.appointment_datetime)}
                </div>
                <div className="text-slate-600 text-xs mt-0.5">
                  {isPast ? 'Prošlo' : 'h'}
                </div>
              </div>

              {/* Divider */}
              <div className={`w-px self-stretch ${isPast ? 'bg-slate-800' : 'bg-sky-500/30'}`} />

              {/* Patient info + Actions */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  // Edit form
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Datum i vreme</label>
                      <input
                        type="datetime-local"
                        value={editDatetime}
                        onChange={(e) => setEditDatetime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Doktor</label>
                      <input
                        type="text"
                        value={editDoctor}
                        onChange={(e) => setEditDoctor(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                        disabled={isSubmitting}
                      />
                    </div>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    {successMsg && <p className="text-xs text-emerald-400">{successMsg}</p>}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSubmitting}
                        className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-600/50 text-white text-xs rounded-lg font-medium transition-colors"
                      >
                        <Check size={14} />
                        Sačuvaj
                      </button>
                      <button
                        onClick={() => setEditingApptId(null)}
                        disabled={isSubmitting}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 text-white text-xs rounded-lg font-medium transition-colors"
                      >
                        <X size={14} />
                        Otkaži
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Display mode */}
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-white font-semibold leading-tight">
                          {appt.patient?.first_name} {appt.patient?.last_name ?? ''}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5 font-mono">
                          {appt.patient?.phone?.startsWith('/') ? '/' : appt.patient?.phone}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {catInfo && (
                          <span className={`text-xs font-medium ${catInfo.color}`}>
                            {catInfo.label}
                          </span>
                        )}
                        {appt.doctor_name && (
                          <span className="text-xs text-slate-500 font-medium">
                            {appt.doctor_name}
                          </span>
                        )}
                        {appt.reminder_sent && (
                          <span className="text-xs text-emerald-400 font-medium mt-1">
                            ✓ SMS Poslat
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Treatment */}
                    {appt.treatment_today && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock size={12} />
                          {appt.treatment_today}
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isPast && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleEditClick(appt)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg font-medium transition-colors"
                        >
                          <Edit2 size={12} />
                          Izmeni
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(appt.id)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-red-900/30 text-red-400 rounded-lg font-medium transition-colors"
                        >
                          <Trash2 size={12} />
                          Obriši
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Delete confirmation */}
              {deleteConfirmId === appt.id && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-2xl flex items-center justify-center p-4"
                >
                  <div className="bg-slate-900 border border-red-500/30 rounded-xl p-4 max-w-sm">
                    <p className="text-white font-medium mb-4">
                      Da li sigurno želiš obrisati termin za {appt.patient?.first_name}?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(appt.id)}
                        disabled={isSubmitting}
                        className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white text-sm rounded-lg font-medium transition-colors"
                      >
                        Obriši
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        disabled={isSubmitting}
                        className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 text-white text-sm rounded-lg font-medium transition-colors"
                      >
                        Otkaži
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
