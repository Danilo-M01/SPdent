'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { X, CheckCircle2 } from 'lucide-react'

// FDI two-digit notation
// Upper jaw: 18-11 (right), 21-28 (left)
// Lower jaw: 48-41 (right), 31-38 (left)

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]

type ToothStatus = 'healthy' | 'caries' | 'filled' | 'missing' | 'implant' | 'crown'

interface ToothState {
  status: ToothStatus
  notes?: string
}

interface DentalChartProps {
  patientId: string
  initialToothData: Record<number, ToothState>
}

const STATUS_CONFIG: Record<ToothStatus, { label: string; color: string; bg: string; border: string }> = {
  healthy:  { label: 'Zdrav',    color: 'text-slate-600 font-semibold', bg: 'fill-slate-50',   border: 'stroke-slate-300' },
  caries:   { label: 'Karijes',  color: 'text-red-700 font-semibold',   bg: 'fill-red-50',     border: 'stroke-red-400' },
  filled:   { label: 'Plomba',   color: 'text-sky-700 font-semibold',   bg: 'fill-sky-50',     border: 'stroke-sky-400' },
  crown:    { label: 'Krunica',  color: 'text-violet-700 font-semibold', bg: 'fill-violet-50',  border: 'stroke-violet-400' },
  missing:  { label: 'Nedostaje',color: 'text-slate-500 font-semibold', bg: 'fill-slate-100',   border: 'stroke-slate-200' },
  implant:  { label: 'Implant',  color: 'text-emerald-700 font-semibold',bg: 'fill-emerald-50',border: 'stroke-emerald-400' },
}

const STATUS_ORDER: ToothStatus[] = ['healthy', 'caries', 'filled', 'crown', 'missing', 'implant']

// Determines if a tooth is a molar (wider shape)
function isMolar(num: number) {
  const last = num % 10
  return last >= 6 && last <= 8
}
function isPremolar(num: number) {
  const last = num % 10
  return last === 4 || last === 5
}


function ToothSVG({
  num, x, y, isUpper, status, onClick
}: {
  num: number; x: number; y: number; isUpper: boolean; status: ToothStatus; onClick: () => void
}) {
  const cfg = STATUS_CONFIG[status]
  const w = isMolar(num) ? 28 : isPremolar(num) ? 22 : 18
  const h = isMolar(num) ? 34 : 30
  const cx = x + w / 2

  return (
    <g
      onClick={onClick}
      className="cursor-pointer group"
      role="button"
      aria-label={`Zub ${num}: ${cfg.label}`}
    >
      {/* Glow effect for active states */}
      {status !== 'healthy' && status !== 'missing' && (
        <ellipse
          cx={cx}
          cy={isUpper ? y + h / 2 : y + h / 2}
          rx={w / 2 + 3}
          ry={h / 2 + 3}
          className={`opacity-20 ${
            status === 'caries' ? 'fill-red-500' :
            status === 'filled' ? 'fill-sky-500' :
            status === 'crown' ? 'fill-violet-500' :
            'fill-emerald-500'
          }`}
        />
      )}
      {/* Tooth body */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={5}
        ry={5}
        className={`${cfg.bg} ${cfg.border} transition-all duration-200 group-hover:opacity-80`}
        strokeWidth={1.5}
      />
      {/* Missing X indicator */}
      {status === 'missing' && (
        <>
          <line x1={x + 5} y1={y + 5} x2={x + w - 5} y2={y + h - 5} stroke="#475569" strokeWidth={2} />
          <line x1={x + w - 5} y1={y + 5} x2={x + 5} y2={y + h - 5} stroke="#475569" strokeWidth={2} />
        </>
      )}
      {/* Implant circle */}
      {status === 'implant' && (
        <circle cx={cx} cy={y + h / 2} r={6} fill="none" stroke="#10b981" strokeWidth={1.5} strokeDasharray="3 2" />
      )}
      {/* Tooth number label */}
      <text
        x={cx}
        y={isUpper ? y - 4 : y + h + 12}
        textAnchor="middle"
        className="fill-slate-500 select-none"
        fontSize={8}
        fontFamily="monospace"
      >
        {num}
      </text>
    </g>
  )
}

export default function DentalChart({ patientId, initialToothData }: DentalChartProps) {
  const [toothData, setToothData] = useState<Record<number, ToothState>>(initialToothData)
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const getStatus = (num: number): ToothStatus => toothData[num]?.status ?? 'healthy'

  const handleToothClick = (num: number) => {
    setSelectedTooth(prev => prev === num ? null : num)
  }

  const handleSetStatus = useCallback(async (num: number, status: ToothStatus) => {
    setSaving(true)
    const prev = toothData[num]?.status ?? 'healthy'
    // Optimistic update
    setToothData(d => ({ ...d, [num]: { ...d[num], status } }))

    const supabase = createClient()
    const { error } = await supabase
      .from('tooth_status')
      .upsert(
        { patient_id: patientId, tooth_number: num, status },
        { onConflict: 'patient_id,tooth_number' }
      )

    if (error) {
      // Rollback on error
      setToothData(d => ({ ...d, [num]: { ...d[num], status: prev } }))
      console.error('[DentalChart] upsert error:', error.message)
    }
    setSaving(false)
    setSelectedTooth(null)
  }, [patientId, toothData])

  // Layout constants
  const TOOTH_GAP = 4
  const START_X = 20

  // Build x positions for each quadrant
  function buildXPositions(teeth: number[]): number[] {
    let x = START_X
    return teeth.map(num => {
      const pos = x
      x += (isMolar(num) ? 28 : isPremolar(num) ? 22 : 18) + TOOTH_GAP
      return pos
    })
  }

  const upperRightX = buildXPositions([...UPPER_RIGHT].reverse()).reverse()
  const upperLeftX  = buildXPositions(UPPER_LEFT).map(x => x + upperRightX[0] + 28 + TOOTH_GAP * 2 + 16)
  // Lower jaw mirrors upper jaw: 41 aligns under 11, 48 aligns under 18, 31 aligns under 21, 38 aligns under 28
  const lowerRightX = buildXPositions([...LOWER_RIGHT].reverse()).reverse()
  const lowerLeftX  = [...upperLeftX]

  const SVG_WIDTH = upperLeftX[upperLeftX.length - 1] + 34 + START_X
  const UPPER_Y = 30
  const LOWER_Y = 110

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-slate-900">Dentalni Karton (FDI Notacija)</h4>
        {saving && <span className="text-xs text-slate-400 animate-pulse">Čuvanje...</span>}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_ORDER.map(s => {
          const cfg = STATUS_CONFIG[s]
          return (
            <div key={s} className={`flex items-center gap-1.5 text-xs ${cfg.color}`}>
              <div className={`w-3 h-3 rounded-sm ${
                s === 'healthy' ? 'bg-slate-50 border border-slate-350' :
                s === 'caries' ? 'bg-red-50 border border-red-400' :
                s === 'filled' ? 'bg-sky-50 border border-sky-400' :
                s === 'crown' ? 'bg-violet-50 border border-violet-400' :
                s === 'missing' ? 'bg-slate-100 border border-slate-200' :
                'bg-emerald-50 border border-emerald-400'
              }`} />
              {cfg.label}
            </div>
          )
        })}
      </div>

      {/* SVG Dental Chart */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} 195`}
          width={SVG_WIDTH}
          height={195}
          className="min-w-[600px]"
          style={{ fontFamily: 'monospace' }}
        >
          {/* Upper jaw label */}
          <text x={SVG_WIDTH / 2} y={14} textAnchor="middle" fontSize={9} className="fill-slate-400 font-bold select-none">GORNJA VILICA</text>

          {/* Center divider (solid lines, perfectly centered) */}
          <line x1={SVG_WIDTH / 2} y1={20} x2={SVG_WIDTH / 2} y2={175} stroke="#E2E8F0" strokeWidth={1.5} />
          <line x1={20} y1={87} x2={SVG_WIDTH - 20} y2={87} stroke="#E2E8F0" strokeWidth={1.5} />

          {/* Lower jaw label */}
          <text x={SVG_WIDTH / 2} y={192} textAnchor="middle" fontSize={9} className="fill-slate-400 font-bold select-none">DONJA VILICA</text>

          {/* Upper right (18..11) */}
          {UPPER_RIGHT.map((num, i) => (
            <ToothSVG
              key={num}
              num={num}
              x={upperRightX[i]}
              y={UPPER_Y}
              isUpper={true}
              status={getStatus(num)}
              onClick={() => handleToothClick(num)}
            />
          ))}

          {/* Upper left (21..28) */}
          {UPPER_LEFT.map((num, i) => (
            <ToothSVG
              key={num}
              num={num}
              x={upperLeftX[i]}
              y={UPPER_Y}
              isUpper={true}
              status={getStatus(num)}
              onClick={() => handleToothClick(num)}
            />
          ))}

          {/* Lower right (48..41) */}
          {LOWER_RIGHT.map((num, i) => {
            return (
              <ToothSVG
                key={num}
                num={num}
                x={lowerRightX[i]}
                y={LOWER_Y}
                isUpper={false}
                status={getStatus(num)}
                onClick={() => handleToothClick(num)}
              />
            )
          })}

          {/* Lower left (31..38) */}
          {LOWER_LEFT.map((num, i) => (
            <ToothSVG
              key={num}
              num={num}
              x={lowerLeftX[i]}
              y={LOWER_Y}
              isUpper={false}
              status={getStatus(num)}
              onClick={() => handleToothClick(num)}
            />
          ))}
        </svg>
      </div>

      {/* Popover for selected tooth */}
      <AnimatePresence>
        {selectedTooth !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-900 font-bold text-sm">
                Zub #{selectedTooth} — {STATUS_CONFIG[getStatus(selectedTooth)].label}
              </p>
              <button
                onClick={() => setSelectedTooth(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_ORDER.map(s => {
                const cfg = STATUS_CONFIG[s]
                const isActive = getStatus(selectedTooth) === s
                return (
                  <button
                    key={s}
                    onClick={() => handleSetStatus(selectedTooth, s)}
                    disabled={saving}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                      isActive
                        ? `${cfg.bg.replace('fill-', 'bg-')} ${cfg.border.replace('stroke-', 'border-')} ${cfg.color}`
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-350 hover:text-slate-850'
                    }`}
                  >
                    {isActive && <CheckCircle2 size={11} />}
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
