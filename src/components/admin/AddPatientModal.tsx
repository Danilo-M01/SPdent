'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { addPatient, checkPatientDuplicates, type ActionResult, type DuplicateCheckResult } from '@/app/admin/actions'
import type { Patient } from '@/app/admin/(dashboard)/page'
import { X, UserPlus, AlertCircle, AlertTriangle, Users, Loader2 } from 'lucide-react'

interface AddPatientModalProps {
  onClose: () => void
  onPatientAdded?: (patient: Patient) => void
}

const inputClass =
  'w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-sky-500/10 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all duration-200'

const labelClass = 'block text-xs font-semibold text-slate-650 mb-1.5'

export default function AddPatientModal({ onClose, onPatientAdded }: AddPatientModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Controlled form fields for live duplicate detection
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [chartNumber, setChartNumber] = useState('')
  const [email, setEmail] = useState('')
  const [parentName, setParentName] = useState('')
  const [category, setCategory] = useState('regular')
  const [doctorName, setDoctorName] = useState('')
  const [medicalAlerts, setMedicalAlerts] = useState('')
  const [notes, setNotes] = useState('')

  // Deduplication flags
  const [isSharedPhone, setIsSharedPhone] = useState(false)
  const [allowHomonym, setAllowHomonym] = useState(false)

  // Real-time duplicate check states
  const [duplicates, setDuplicates] = useState<DuplicateCheckResult>({})
  const [isChecking, setIsChecking] = useState(false)
  const [phoneValidationError, setPhoneValidationError] = useState<string | null>(null)

  // Debounced live duplicate check
  useEffect(() => {
    // Basic phone validation on client
    const rawClean = phone.replace(/[^0-9]/g, '')
    if (phone.trim() && phone.trim() !== '/' && rawClean.length > 0 && rawClean.length < 6) {
      setPhoneValidationError('Broj telefona mora sadržati bar 6 cifara ili unesite "/" ako nema telefon.')
    } else {
      setPhoneValidationError(null)
    }

    const timer = setTimeout(async () => {
      const hasPhone = phone.trim().length >= 6
      const hasChart = chartNumber.trim().length >= 1
      const hasName = firstName.trim().length >= 2 && lastName.trim().length >= 2

      if (!hasPhone && !hasChart && !hasName) {
        setDuplicates({})
        return
      }

      setIsChecking(true)
      try {
        const res = await checkPatientDuplicates({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          chartNumber: chartNumber.trim(),
        })
        setDuplicates(res)
      } catch (e) {
        console.error('Greška pri proveri duplikata:', e)
      } finally {
        setIsChecking(false)
      }
    }, 450)

    return () => clearTimeout(timer)
  }, [firstName, lastName, phone, chartNumber])

  // Reset duplicate flags if inputs change
  useEffect(() => {
    setIsSharedPhone(false)
  }, [phone])

  useEffect(() => {
    setAllowHomonym(false)
  }, [firstName, lastName])

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)

    // Validate phone length if entered
    const rawClean = phone.replace(/[^0-9]/g, '')
    if (phone.trim() && phone.trim() !== '/' && rawClean.length < 6) {
      setErrorMsg('Broj telefona mora sadržati bar 6 cifara ili ostavite prazno / unesite "/" ako pacijent nema telefon.')
      return
    }

    // Chart number conflict blocking
    if (duplicates.chartConflict) {
      setErrorMsg(`Broj kartona "${duplicates.chartConflict.chart_number}" već koristi pacijent ${duplicates.chartConflict.name}.`)
      return
    }

    // Exact phone + same name duplicate blocking
    if (duplicates.phoneConflict?.isSameName) {
      setErrorMsg(`Pacijent sa ovim telefonom i imenom već postoji u bazi (${duplicates.phoneConflict.name}).`)
      return
    }

    // Shared phone warning requires check
    if (duplicates.phoneConflict && !duplicates.phoneConflict.isSameName && !isSharedPhone) {
      setErrorMsg(`Broj telefona već pripada pacijentu ${duplicates.phoneConflict.name}. Označite opciju "Član porodice / deljeni telefon" ukoliko dele isti broj.`)
      return
    }

    // Homonym warning requires check
    if (duplicates.nameConflict && !allowHomonym) {
      setErrorMsg(`Pacijent sa imenom "${duplicates.nameConflict.name}" već postoji u bazi. Označite "Potvrdi unos (imenjak)" ukoliko je u pitanju druga osoba istog imena.`)
      return
    }

    const formData = new FormData()
    formData.append('first_name', firstName)
    formData.append('last_name', lastName)
    formData.append('phone', phone)
    formData.append('chart_number', chartNumber)
    formData.append('email', email)
    formData.append('parent_name', parentName)
    formData.append('category', category)
    formData.append('doctor_name', doctorName)
    formData.append('medical_alerts', medicalAlerts)
    formData.append('notes', notes)
    if (isSharedPhone) formData.append('is_shared_phone', 'true')
    if (allowHomonym) formData.append('allow_homonym', 'true')

    startTransition(async () => {
      const result: ActionResult = await addPatient(null, formData)
      if (result.success) {
        if (result.patient && onPatientAdded) {
          onPatientAdded(result.patient)
        }
        router.refresh()
        onClose()
      } else {
        setErrorMsg(result.error || 'Došlo je do greške pri dodavanju pacijenta.')
      }
    })
  }, [
    firstName, lastName, phone, chartNumber, email, parentName,
    category, doctorName, medicalAlerts, notes, isSharedPhone,
    allowHomonym, duplicates, onPatientAdded, onClose, router
  ])

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40"
      />

      {/* Modal */}
      <motion.div
        key="modal-panel"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:pl-64 pointer-events-none"
      >
        <div
          data-lenis-prevent
          className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl pointer-events-auto max-h-[90vh] overflow-y-auto premium-scrollbar"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center">
                <UserPlus size={16} className="text-[#0284C7]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[#0F172A] font-bold text-sm">Novi pacijent</h2>
                  {isChecking && (
                    <span className="flex items-center gap-1 text-[11px] text-sky-600 font-medium">
                      <Loader2 size={11} className="animate-spin" /> provera...
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-xs">Popunite podatke o pacijentu uz proveru duplikata</p>
              </div>
            </div>
            <button
              id="add-patient-modal-close"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Row: Ime + Prezime */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="modal-first-name" className={labelClass}>
                  Ime <span className="text-red-500">*</span>
                </label>
                <input
                  id="modal-first-name"
                  name="first_name"
                  type="text"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Marko"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="modal-last-name" className={labelClass}>Prezime</label>
                <input
                  id="modal-last-name"
                  name="last_name"
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Marković"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Homonym Duplicate Warning */}
            {duplicates.nameConflict && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-amber-50/80 border border-amber-250 rounded-xl p-3 text-xs text-amber-900"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p>
                      Već postoji pacijent sa ovim imenom: <strong>{duplicates.nameConflict.name}</strong>
                      {duplicates.nameConflict.chart_number ? ` (Karton #${duplicates.nameConflict.chart_number})` : ''}
                      {duplicates.nameConflict.phone ? ` • Tel: ${duplicates.nameConflict.phone}` : ''}
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer text-amber-950 font-medium">
                      <input
                        type="checkbox"
                        checked={allowHomonym}
                        onChange={e => setAllowHomonym(e.target.checked)}
                        className="rounded border-amber-300 text-[#0284C7] focus:ring-sky-500/20"
                      />
                      <span>U pitanju je druga osoba (imenjak), nastavi sa unosom</span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Row: Telefon + Broj kartona */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="modal-phone" className={labelClass}>
                  Telefon
                </label>
                <input
                  id="modal-phone"
                  name="phone"
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+381 60 123 4567 (ili '/')"
                  className={`${inputClass} ${phoneValidationError || duplicates.phoneConflict?.isSameName ? 'border-rose-400 focus:border-rose-500' : ''}`}
                />
                {phoneValidationError && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">
                    {phoneValidationError}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="modal-chart-number" className={labelClass}>
                  Broj kartona
                </label>
                <input
                  id="modal-chart-number"
                  name="chart_number"
                  type="text"
                  value={chartNumber}
                  onChange={e => setChartNumber(e.target.value)}
                  placeholder="npr. 1245"
                  className={`${inputClass} ${duplicates.chartConflict ? 'border-rose-400 focus:border-rose-500' : ''}`}
                />
              </div>
            </div>

            {/* Chart Conflict Alert */}
            {duplicates.chartConflict && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 text-xs text-rose-700 flex items-center gap-2"
              >
                <AlertCircle size={14} className="shrink-0 text-rose-600" />
                <span>
                  Broj kartona <strong>"{duplicates.chartConflict.chart_number}"</strong> već koristi pacijent <strong>{duplicates.chartConflict.name}</strong>.
                </span>
              </motion.div>
            )}

            {/* Phone Conflict (Exact duplicate or Family shared phone) */}
            {duplicates.phoneConflict && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={`rounded-xl p-3 text-xs ${
                  duplicates.phoneConflict.isSameName
                    ? 'bg-rose-50 border border-rose-250 text-rose-800'
                    : 'bg-sky-50 border border-sky-200 text-sky-900'
                }`}
              >
                {duplicates.phoneConflict.isSameName ? (
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                    <p>
                      Pacijent <strong>{duplicates.phoneConflict.name}</strong> sa ovim brojem telefona već postoji u bazi! Izbegavajte kreiranje duplikata.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <Users size={16} className="text-[#0284C7] shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <p>
                        Ovaj broj telefona već koristi: <strong>{duplicates.phoneConflict.name}</strong>.
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                        <input
                          type="checkbox"
                          checked={isSharedPhone}
                          onChange={e => setIsSharedPhone(e.target.checked)}
                          className="rounded border-slate-300 text-[#0284C7] focus:ring-sky-500/20"
                        />
                        <span>Član porodice / deljeni broj telefona (npr. dete, supružnik)</span>
                      </label>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="modal-email" className={labelClass}>Email</label>
              <input
                id="modal-email"
                name="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="marko@email.com"
                className={inputClass}
              />
            </div>

            {/* Roditelj */}
            <div>
              <label htmlFor="modal-parent" className={labelClass}>Ime roditelja / staratelja</label>
              <input
                id="modal-parent"
                name="parent_name"
                type="text"
                value={parentName}
                onChange={e => setParentName(e.target.value)}
                placeholder="npr. Vesna (majka)"
                className={inputClass}
              />
            </div>

            {/* Row: Kategorija + Izabrani zubar */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="modal-category" className={labelClass}>Kategorija</label>
                <select
                  id="modal-category"
                  name="category"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className={inputClass}
                >
                  <option value="regular">Regularni</option>
                  <option value="implant">Implant</option>
                  <option value="proteza">Protetika</option>
                </select>
              </div>
              <div>
                <label htmlFor="modal-doctor" className={labelClass}>Izabrani zubar / lekar</label>
                <select
                  id="modal-doctor"
                  name="doctor_name"
                  value={doctorName}
                  onChange={e => setDoctorName(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Izaberite (opciono)</option>
                  <option value="dr Slaviša Petković">dr Slaviša Petković</option>
                  <option value="dr Nebojša Kostić">dr Nebojša Kostić</option>
                  <option value="dr Đurđina Grujić">dr Đurđina Grujić</option>
                </select>
              </div>
            </div>

            {/* Medicinska upozorenja — full width, highlighted */}
            <div>
              <label htmlFor="modal-alerts" className={labelClass}>
                <span className="text-red-650 font-semibold">⚠️ Medicinska upozorenja / Alergije</span>
              </label>
              <textarea
                id="modal-alerts"
                name="medical_alerts"
                rows={2}
                value={medicalAlerts}
                onChange={e => setMedicalAlerts(e.target.value)}
                placeholder="npr. Alergija na penicilin, dijabetes..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="modal-notes" className={labelClass}>Napomene</label>
              <textarea
                id="modal-notes"
                name="notes"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Dodatne napomene..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Server Error Message */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                >
                  <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                  <span className="text-red-700 text-sm font-medium leading-snug">{errorMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Otkaži
              </button>
              <button
                id="add-patient-submit-btn"
                type="submit"
                disabled={isPending || Boolean(duplicates.chartConflict) || (Boolean(duplicates.phoneConflict?.isSameName))}
                className="flex-1 bg-[#0284C7] hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Dodavanje...</span>
                  </>
                ) : (
                  'Dodaj pacijenta'
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  )
}
