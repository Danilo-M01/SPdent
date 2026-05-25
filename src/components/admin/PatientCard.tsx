'use client'

import { motion } from 'framer-motion'
import type { Patient } from '@/app/admin/(dashboard)/page'
import {
  Phone,
  AlertTriangle,
  Calendar,
} from 'lucide-react'

const CATEGORY_BADGES: Record<string, { label: string; cls: string }> = {
  regular: { label: 'Regularni', cls: 'text-slate-400' },
  implant:  { label: 'Implant',  cls: 'text-sky-400' },
  proteza:  { label: 'Protetika', cls: 'text-violet-400' },
}

interface PatientCardProps {
  patient: Patient
  index: number
}

export default function PatientCard({ patient, index }: PatientCardProps) {
  const hasAlerts = Boolean(patient.medical_alerts)
  const catBadge = CATEGORY_BADGES[patient.category ?? 'regular']

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="group relative bg-slate-900/70 backdrop-blur-xl border border-white/5 hover:border-white/10 rounded-2xl p-5 flex flex-col gap-4 shadow-lg shadow-black/30 overflow-hidden"
    >
      {/* Glass shimmer — CSS only, no JS re-render */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />

      {/* Name + badges row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-base leading-tight truncate">
            {patient.first_name} {patient.last_name ?? ''}
          </h3>
          {patient.parent_name && (
            <p className="text-slate-500 text-xs mt-0.5 truncate">
              Roditelj: {patient.parent_name}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 items-end shrink-0">
          {/* Category badge */}
          {catBadge && (
            <span className={`text-xs font-medium ${catBadge.cls}`}>
              {catBadge.label}
            </span>
          )}
          {/* Flashing red badge for medical alerts */}
          {hasAlerts && (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex items-center gap-1 bg-red-500/15 text-red-400 text-xs font-medium px-2 py-0.5 rounded-full"
              title={patient.medical_alerts ?? ''}
            >
              <AlertTriangle size={11} />
              Upozorenje
            </motion.span>
          )}
        </div>
      </div>

      {/* Medical alert detail box */}
      {hasAlerts && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2">
          <p className="text-red-300 text-xs leading-relaxed">
            <span className="font-semibold">⚠️ Alergije/Upozorenja: </span>
            {patient.medical_alerts}
          </p>
        </div>
      )}

      {/* Contact info */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Phone size={13} className="text-slate-500 shrink-0" />
          {patient.phone.startsWith('/') ? (
            <span className="text-slate-500 font-medium">/</span>
          ) : (
            <a href={`tel:${patient.phone}`} className="hover:text-sky-400 transition-colors">
              {patient.phone}
            </a>
          )}
        </div>
        {patient.email && (
          <p className="pl-5 text-slate-500 text-xs truncate">{patient.email}</p>
        )}
        {patient.next_appointment && (
          <div className="mt-2 flex items-center gap-2 text-emerald-400 text-xs font-medium">
            <Calendar size={13} />
            Termin: {new Intl.DateTimeFormat('sr-RS', { 
              day: '2-digit', 
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date(patient.next_appointment))}
            {patient.next_appointment_doctor && ` — ${patient.next_appointment_doctor}`}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/5 mt-2">
        {patient.phone.startsWith('/') ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800/40 border border-white/5 text-slate-500 text-xs font-medium py-2.5 rounded-xl cursor-not-allowed">
            <Phone size={13} />
            Nema telefon
          </div>
        ) : (
          <a
            id={`call-btn-${patient.id}`}
            href={`tel:${patient.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 hover:border-sky-500/40 text-sky-400 text-xs font-medium py-2.5 rounded-xl transition-all duration-200"
          >
            <Phone size={13} />
            Pozovi
          </a>
        )}
      </div>
    </motion.div>
  )
}
