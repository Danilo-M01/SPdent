'use client'

import { motion } from 'framer-motion'
import type { Patient } from '@/app/admin/(dashboard)/page'
import {
  Phone,
  AlertTriangle,
  Calendar,
} from 'lucide-react'

const CATEGORY_BADGES: Record<string, { label: string; cls: string }> = {
  regular: { label: 'Regularni', cls: 'text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/60' },
  implant:  { label: 'Implant',  cls: 'text-[#0284C7] bg-[#E0F2FE] px-2 py-0.5 rounded-lg border border-sky-100' },
  proteza:  { label: 'Protetika', cls: 'text-violet-750 bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-100' },
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
      className="group relative bg-white border border-[#E2E8F0] hover:border-slate-300 rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md overflow-hidden"
    >
      {/* Subtle light background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />

      {/* Name + badges row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-[#0F172A] font-semibold text-base leading-tight truncate">
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
            <span className={`text-[11px] font-semibold ${catBadge.cls}`}>
              {catBadge.label}
            </span>
          )}
          {/* Flashing red badge for medical alerts */}
          {hasAlerts && (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex items-center gap-1 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full"
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
        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          <p className="text-red-700 text-xs leading-relaxed">
            <span className="font-semibold">⚠️ Alergije/Upozorenja: </span>
            {patient.medical_alerts}
          </p>
        </div>
      )}

      {/* Contact info */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-slate-600 text-sm">
          <Phone size={13} className="text-slate-400 shrink-0" />
          {patient.phone.startsWith('/') ? (
            <span className="text-slate-400 font-medium">/</span>
          ) : (
            <a href={`tel:${patient.phone}`} className="text-[#0284C7] hover:text-sky-500 font-medium transition-colors">
              {patient.phone}
            </a>
          )}
        </div>
        {patient.email && (
          <p className="pl-5 text-slate-500 text-xs truncate">{patient.email}</p>
        )}
        {patient.next_appointment && (
          <div className="mt-2 flex items-center gap-2 text-emerald-600 text-xs font-semibold">
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
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-2">
        {patient.phone.startsWith('/') ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-400 text-xs font-medium py-2.5 rounded-xl cursor-not-allowed">
            <Phone size={13} />
            Nema telefon
          </div>
        ) : (
          <a
            id={`call-btn-${patient.id}`}
            href={`tel:${patient.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[#0284C7] text-xs font-semibold py-2.5 rounded-xl transition-all duration-200"
          >
            <Phone size={13} />
            Pozovi
          </a>
        )}
      </div>
    </motion.div>
  )
}
