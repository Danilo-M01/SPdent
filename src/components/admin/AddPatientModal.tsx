'use client'

import { useActionState } from 'react'
import { motion } from 'framer-motion'
import { addPatient, type ActionResult } from '@/app/admin/actions'
import { X, UserPlus } from 'lucide-react'

interface AddPatientModalProps {
  onClose: () => void
}

const inputClass =
  'w-full bg-slate-800/60 border border-white/10 hover:border-white/20 focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200'

const labelClass = 'block text-xs font-medium text-slate-400 mb-1.5'

export default function AddPatientModal({ onClose }: AddPatientModalProps) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => {
      const result = await addPatient(null, formData)
      if (result.success) onClose()
      return result
    },
    null
  )

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
      />

      {/* Modal */}
      <motion.div
        key="modal-panel"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          data-lenis-prevent
          className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 pointer-events-auto max-h-[90vh] overflow-y-auto premium-scrollbar"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/20 flex items-center justify-center">
                <UserPlus size={16} className="text-sky-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">Novi pacijent</h2>
                <p className="text-slate-500 text-xs">Popunite podatke pacijenta</p>
              </div>
            </div>
            <button
              id="add-patient-modal-close"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form */}
          <form action={formAction} className="px-6 py-5 space-y-4">
            {/* Row: Ime + Prezime */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="modal-first-name" className={labelClass}>
                  Ime <span className="text-red-400">*</span>
                </label>
                <input
                  id="modal-first-name"
                  name="first_name"
                  type="text"
                  required
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
                  placeholder="Marković"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Telefon */}
            <div>
              <label htmlFor="modal-phone" className={labelClass}>
                Telefon
              </label>
              <input
                id="modal-phone"
                name="phone"
                type="text"
                placeholder="+381 60 123 4567 (ili '/' / prazno)"
                className={inputClass}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="modal-email" className={labelClass}>Email</label>
              <input
                id="modal-email"
                name="email"
                type="email"
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
                placeholder="Za maloletnike"
                className={inputClass}
              />
            </div>

            {/* Kategorija pacijenta */}
            <div>
              <label htmlFor="modal-category" className={labelClass}>Kategorija pacijenta</label>
              <select
                id="modal-category"
                name="category"
                className={inputClass}
                defaultValue="regular"
              >
                <option value="regular">Regularni pacijent (Opšta stomatologija)</option>
                <option value="implant">Implantologija</option>
                <option value="proteza">Protetika / Proteze</option>
              </select>
            </div>

            {/* Medicinska upozorenja — full width, highlighted */}
            <div>
              <label htmlFor="modal-alerts" className={labelClass}>
                <span className="text-red-400">⚠️ Medicinska upozorenja / Alergije (slobodan tekst)</span>
              </label>
              <textarea
                id="modal-alerts"
                name="medical_alerts"
                rows={2}
                placeholder="npr. Alergija na penicilin, dijabetes..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Sistematska anamneza */}
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">Sistematska anamneza</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'has_hypertension',     label: '🫀 Hipertenzija' },
                  { name: 'has_diabetes',          label: '🩸 Dijabetes' },
                  { name: 'takes_anticoagulants',  label: '💊 Antikoagulansi' },
                  { name: 'penicillin_allergy',    label: '⚠️ Alergija na Penicilin' },
                ].map(({ name, label }) => (
                  <label key={name} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      name={name}
                      value="true"
                      className="w-4 h-4 rounded border-white/10 bg-slate-800 accent-red-500 cursor-pointer"
                    />
                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Saglasnost */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="consent_signed"
                  value="true"
                  className="w-4 h-4 rounded border-white/10 bg-slate-800 accent-sky-500 cursor-pointer"
                />
                <span className="text-sm text-slate-300">Pacijent je potpisao saglasnost za tretman (GDPR)</span>
              </label>
            </div>

            {/* Dug */}
            <div>
              <label htmlFor="modal-debt" className={labelClass}>Početni dug (RSD)</label>
              <input
                id="modal-debt"
                name="total_debt"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                className={inputClass}
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="modal-notes" className={labelClass}>Napomene</label>
              <textarea
                id="modal-notes"
                name="notes"
                rows={2}
                placeholder="Dodatne napomene..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Error */}
            {state?.error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
              >
                <span className="text-red-400 text-sm">{state.error}</span>
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Otkaži
              </button>
              <button
                id="add-patient-submit-btn"
                type="submit"
                disabled={isPending}
                className="flex-1 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {isPending ? 'Dodavanje...' : 'Dodaj pacijenta'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  )
}
