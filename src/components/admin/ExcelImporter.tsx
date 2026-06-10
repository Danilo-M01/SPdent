'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import * as XLSX from 'xlsx'
import { motion } from 'framer-motion'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { bulkImportPatients, type ImportPatient } from '@/app/admin/actions'

interface ExcelImporterProps {
  onClose: () => void
}

const headerMap: Record<string, string> = {
  first_name: 'Ime',
  last_name: 'Prezime',
  phone: 'Telefon',
  email: 'Email',
  parent_name: 'Ime roditelja',
  medical_alerts: 'Alergije/Upozorenja',
  notes: 'Napomene/Podaci',
  category: 'Kategorija',
  appointment_date: 'Sledeći termin',
  doctor_name: 'Lekar'
}

function parseImportedDate(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null

  // If SheetJS parsed it as a JS Date object
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Belgrade',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric',
        hour12: false
      }).formatToParts(val)
      const fp: Record<string, string> = {}
      parts.forEach(p => { if (p.type !== 'literal') fp[p.type] = p.value })
      const pad = (s: string) => s.padStart(2, '0')
      return `${fp.year}-${pad(fp.month)}-${pad(fp.day)}T${pad(fp.hour)}:${pad(fp.minute)}`
    } catch {
      return val.toISOString().substring(0, 16)
    }
  }

  // If it's a number (Excel date serial)
  if (typeof val === 'number') {
    if (val > 30000 && val < 60000) {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000))
      return parseImportedDate(date)
    }
    return null
  }

  const str = String(val).trim()
  if (!str) return null

  // Serbian format: "15.06.2026. 10:00" or "15.06.2026. u 10:00" or "15.06.2026 10:00" or "15.6.2026. 10:00"
  const serbianMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?(?:\s+(?:u\s+)?(\d{1,2})[:.](\d{2}))?/i)
  if (serbianMatch) {
    const day = parseInt(serbianMatch[1], 10)
    const month = parseInt(serbianMatch[2], 10)
    const year = parseInt(serbianMatch[3], 10)
    const hour = serbianMatch[4] ? parseInt(serbianMatch[4], 10) : 10
    const minute = serbianMatch[5] ? parseInt(serbianMatch[5], 10) : 0
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`
  }

  // Slash format: "15/06/2026 10:00" or "15/06/2026"
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?/)
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10)
    const month = parseInt(slashMatch[2], 10)
    const year = parseInt(slashMatch[3], 10)
    const hour = slashMatch[4] ? parseInt(slashMatch[4], 10) : 10
    const minute = slashMatch[5] ? parseInt(slashMatch[5], 10) : 0
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`
  }

  // ISO format: "2026-06-15 10:00" or "2026-06-15T10:00" or "2026-06-15"
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s+)(\d{2})[:.](\d{2})/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T${isoMatch[4]}:${isoMatch[5]}`
  }

  const isoDateOnlyMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoDateOnlyMatch) {
    return `${isoDateOnlyMatch[1]}-${isoDateOnlyMatch[2]}-${isoDateOnlyMatch[3]}T10:00`
  }

  const d = new Date(str)
  if (!isNaN(d.getTime())) {
    return parseImportedDate(d)
  }

  return null
}

function mapDoctorName(raw: unknown): string | null {
  if (!raw) return null
  const str = String(raw).toLowerCase().trim()
  if (str.includes('slaviš') || str.includes('slavis') || str.includes('petković') || str.includes('petkovic')) {
    return 'dr Slaviša Petković'
  }
  if (str.includes('nebojš') || str.includes('nebojs') || str.includes('kostić') || str.includes('kostic')) {
    return 'dr Nebojša Kostić'
  }
  if (str.includes('đurđin') || str.includes('djurdjin') || str.includes('grujić') || str.includes('grujic')) {
    return 'dr Đurđina Grujić'
  }
  if (str.length > 0) {
    const orig = String(raw).trim()
    if (!orig.toLowerCase().startsWith('dr')) {
      return `dr ${orig}`
    }
    return orig
  }
  return null
}

function mapImportedRow(row: Record<string, unknown>): ImportPatient {
  // ── Regex patterns za prepoznavanje podataka ───────────────────────────────
  const PHONE_RE = /^\+?[\d\s\-\(\)\.]{6,20}$/
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const NAME_RE  = /^[A-Za-zÀ-žČčĆćŠšŽžĐđ][A-Za-zÀ-žČčĆćŠšŽžĐđ\s\-'\.]{1,59}$/

  // ── Normalizacija svih ključeva (bez razmaka, tačaka, crtica, slova mala) ──
  const normMap: Record<string, { val: string; origKey: string }> = {}
  for (const key in row) {
    const nk = key.toLowerCase().trim().replace(/[\s\.\-_\/\(\)\[\]#*:;,]+/g, '')
    normMap[nk] = { val: String(row[key] ?? '').trim(), origKey: key }
  }

  // Set za praćenje koje kolone su već mapovane (da ne idu i u notes)
  const usedNormKeys = new Set<string>()

  // ── Smart finder: tačno → fuzzy substring → preskače prazne ──────────────
  function find(keywords: string[]): string {
    // 1. Tačno podudaranje normalizovanog ključa
    for (const kw of keywords) {
      if (normMap[kw]?.val) {
        usedNormKeys.add(kw)
        return normMap[kw].val
      }
    }
    // 2. Fuzzy: normalizovani ključ SADRŽI ključnu reč (ili obrnuto)
    for (const kw of keywords) {
      for (const nk in normMap) {
        if (!usedNormKeys.has(nk) && normMap[nk].val) {
          if (nk.includes(kw) || kw.includes(nk)) {
            usedNormKeys.add(nk)
            return normMap[nk].val
          }
        }
      }
    }
    return ''
  }

  // ── 1. Ime i Prezime ──────────────────────────────────────────────────────
  // Puno ime u jednoj koloni
  let fullName = find([
    'imeiprezime','imeprezime','punoime','fullname','imepacijenta',
    'nazivpacijenta','pacijent','klijent','osiguranik','korisnik','stranka'
  ])
  // Odvojeno ime + prezime
  let firstName = find(['ime','firstname','name'])
  let lastName  = find(['prezime','lastname','porodicnoime','porodičnoime'])

  if (firstName && lastName) {
    firstName = `${firstName} ${lastName}`.trim()
    lastName  = ''
  } else if (!firstName && fullName) {
    firstName = fullName
  }

  // Ako nije pronađeno ni po ključu — pokušaj po obliku vrednosti (poslednji pokušaj)
  if (!firstName) {
    for (const nk in normMap) {
      if (!usedNormKeys.has(nk)) {
        const { val } = normMap[nk]
        if (NAME_RE.test(val) && !PHONE_RE.test(val) && !EMAIL_RE.test(val)) {
          firstName = val
          usedNormKeys.add(nk)
          break
        }
      }
    }
  }
  if (!firstName) firstName = 'Nepoznato'

  // ── 2. Telefon ────────────────────────────────────────────────────────────
  let phone = find([
    'telefon','phone','tel','mobilni','kontakt','gsm','mobitel','mob',
    'brtelefona','brojtelefona','brtel','cellular','celular','handy','natel'
  ])
  // Fallback: prepoznaj po obliku vrednosti
  if (!phone) {
    for (const nk in normMap) {
      if (!usedNormKeys.has(nk)) {
        const { val } = normMap[nk]
        if (PHONE_RE.test(val) && val.replace(/[\s\-\(\)\.]/g,'').length >= 6) {
          phone = val
          usedNormKeys.add(nk)
          break
        }
      }
    }
  }

  // ── 3. Email ──────────────────────────────────────────────────────────────
  let email = find([
    'email','emailadresa','mail','emailaddress','eposta','imejl','eadresa'
  ])
  if (!email) {
    for (const nk in normMap) {
      if (!usedNormKeys.has(nk)) {
        const { val } = normMap[nk]
        if (EMAIL_RE.test(val)) { email = val; usedNormKeys.add(nk); break }
      }
    }
  }

  // ── 4. Ime roditelja ──────────────────────────────────────────────────────
  const parentName = find([
    'imeroditelja','parentname','roditelj','parent','majka','otac',
    'staratelj','guardian','zakonski','zakonskizastupnik'
  ])

  // ── 5. Medicinska upozorenja / Alergije ───────────────────────────────────
  const medicalAlerts = find([
    'alergije','alergija','medicalalerts','upozorenje','upozorenja',
    'medical','zdravlje','oboljenje','dijagnoza','kontraindikacije',
    'hronicnabolest','bolest','anamneza'
  ])

  // ── 6. Kategorija ─────────────────────────────────────────────────────────
  let category = 'regular'
  const rawCat = find([
    'kategorija','category','tip','type','vrsta','grupa','group','tipusluge','tipslucaja'
  ])
  if (rawCat) {
    const rc = rawCat.toLowerCase()
    if (rc.includes('implant')) category = 'implant'
    else if (rc.includes('protez') || rc.includes('protet')) category = 'proteza'
  }

  // ── 7. Termin / Sledeći pregled i Izabrani doktor ─────────────────────────
  const rawDateVal = find([
    'sledecitermin', 'sledećitermin', 'sledećipregled', 'sledecipregled', 'termin', 'datum', 'pregled', 'vreme', 
    'datumtermina', 'datumvreme', 'datumivreme', 'sledećidolazak', 'sledecidolazak',
    'nextvisit', 'nextappointment', 'sledeciposeta', 'narednitermin', 'zakazano', 'sledecaposeta'
  ])
  const appointmentDate = parseImportedDate(rawDateVal)

  const rawDoctorVal = find([
    'izabranidoktor', 'doktor', 'doctor', 'lekar', 'dentist', 'stomatolog',
    'ordinirajucilekar', 'ordinirajućilekar', 'nadlezanlekar', 'nadležni'
  ])
  const mappedDoctorName = mapDoctorName(rawDoctorVal)

  // ── 8. Napomene i specijalna polja → notes ────────────────────────────────
  const notesParts: string[] = []

  const napomena = find([
    'napomena','notes','note','komentar','beleska','beleška','komentari',
    'opis','description','info','informacija','dodatnoinfo','dodatnapomena'
  ])
  if (napomena) notesParts.push(napomena)

  const datumRodjenja = find([
    'datumrodenja','datumrodjenja','datumrođenja','rodjen','rođen','dob',
    'godinaRodjenja','godiste','birthday','birthdate','dateofbirth','datum'
  ])
  if (datumRodjenja) notesParts.push(`Datum rođenja: ${datumRodjenja}`)

  const intervencije = find(['prethodneintervencije','intervencije','anamneza','istorijabolesti'])
  if (intervencije) notesParts.push(`Prethodne intervencije: ${intervencije}`)

  if (rawDoctorVal) notesParts.push(`Izabrani doktor: ${rawDoctorVal}`)
  if (rawDateVal) notesParts.push(`Sledeći pregled: ${rawDateVal}`)

  const dug = find([
    'ukupandug','dug','dugrsd','ukupandugrsd','dugovanje','iznos',
    'duzanplatiti','balans','balance','debt','amount','potraživanje',
    'potrazivanje','stanjekonta','stanje'
  ])
  if (dug) notesParts.push(`Dug iz starog sistema: ${dug} RSD`)

  const pacijentId = find([
    'pacijentid','id','sifra','šifra','broj','rbr','rednibr',
    'rednibrojpacijenta','matbr','maticnibroj','jmbg'
  ])
  if (pacijentId) notesParts.push(`ID iz starog sistema: ${pacijentId}`)

  // ── 9. Sve preostale neprepoznate kolone → notes ──────────────────────────
  const extraFields: string[] = []
  for (const key in row) {
    const nk = key.toLowerCase().trim().replace(/[\s\.\-_\/\(\)\[\]#*:;,]+/g, '')
    if (!usedNormKeys.has(nk)) {
      const val = String(row[key] ?? '').trim()
      if (val) extraFields.push(`${key}: ${val}`)
    }
  }
  if (extraFields.length > 0) {
    notesParts.push(`Uvezeni podaci - [${extraFields.join(' | ')}]`)
  }

  const notes = notesParts.join(' | ')

  return {
    first_name: firstName.trim(),
    last_name: null,
    phone: phone || '/',
    email: email ? String(email).trim() : null,
    parent_name: parentName ? String(parentName).trim() : null,
    medical_alerts: medicalAlerts ? String(medicalAlerts).trim() : null,
    notes: notes ? notes.trim() : null,
    category: category,
    appointment_date: appointmentDate,
    doctor_name: mappedDoctorName,
  }
}

export default function ExcelImporter({ onClose }: ExcelImporterProps) {
  const router = useRouter()
  const [dataPreview, setDataPreview] = useState<Array<ImportPatient & { isInvalid?: boolean }>>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    setError(null)
    if (fileRejections && fileRejections.length > 0) {
      const rejection = fileRejections[0]
      const fileError = rejection.errors[0]
      let msg = 'Učitavanje fajla nije uspelo.'
      if (fileError?.code === 'file-invalid-type') {
        msg = `Format fajla "${rejection.file.name}" nije podržan. Molimo učitajte validan Excel ili CSV fajl.`
      } else if (fileError?.message) {
        msg = `Greška sa fajlom "${rejection.file.name}": ${fileError.message}`
      }
      setError(msg)
      return
    }

    const file = acceptedFiles[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Array<Record<string, unknown>>
        
        const cleanedData = (json
          .map(row => {
            let hasData = false
            const cleanRow: Record<string, unknown> = {}
            for (const key in row) {
              const val = row[key]
              if (val !== null && val !== undefined) {
                const strVal = val instanceof Date ? val : String(val).trim()
                cleanRow[key] = strVal
                if (strVal !== '') hasData = true
              }
            }
            if (!hasData) return null
            const mapped = mapImportedRow(cleanRow)
            // If phone is missing or slash, set to '/'
            if (!mapped.phone || String(mapped.phone).trim() === '' || String(mapped.phone).trim() === '/') {
              mapped.phone = '/'
            }
            return { ...mapped, isInvalid: false }
          })
          .filter(row => row !== null)) as Array<ImportPatient & { isInvalid: boolean }>
        
        if (cleanedData.length === 0) {
          setError('Fajl je prazan ili je pogrešnog formata.')
          return
        }
        
        setDataPreview(cleanedData)
      } catch (err) {
        console.error(err)
        const errMsg = err instanceof Error ? err.message : String(err)
        setError(`Greška pri čitanju fajla: ${errMsg}. Proverite da li je validan Excel ili CSV.`)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      // Excel sa makroima (xlsm) i binarni format (xlsb)
      'application/vnd.ms-excel.sheet.macroenabled.12': ['.xlsm'],
      'application/vnd.ms-excel.sheet.binary.macroenabled.12': ['.xlsb'],
      'text/csv': ['.csv', '.cs'],
      'text/plain': ['.txt', '.cs', '.exceljs'],
      'application/octet-stream': ['.exceljs', '.xlsb', '.xlsm', '.ods'],
    },
    maxFiles: 1,
  })

  const handleUpload = async () => {
    setIsUploading(true)
    setError(null)

    // Strip out the isInvalid flag before sending to the server action
    const payload = dataPreview.map((row) => {
      const copy = { ...row }
      delete copy.isInvalid
      return copy
    })
    const result = await bulkImportPatients(payload)

    if (result.success) {
      setSuccess(true)
      router.refresh()
      setTimeout(() => {
        onClose()
      }, 2000)
    } else {
      setError(result.error || 'Došlo je do greške.')
      setIsUploading(false)
    }
  }

  const validRowsCount = dataPreview.length
  const headers = dataPreview.length > 0 
    ? Object.keys(dataPreview[0]).filter(key => key !== 'isInvalid' && key !== 'last_name') 
    : []

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="text-[#0284C7]" />
            Import Pacijenata
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Ubacite .xlsx, .xls, .xlsm, .xlsb, .ods, .csv, .cs ili .exceljs fajl sa pacijentima
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {success ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-12"
        >
          <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Uspešno uvezeno!</h3>
          <p className="text-slate-500">Pacijenti su dodati u bazu.</p>
        </motion.div>
      ) : (
        <>
          {dataPreview.length === 0 ? (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors
                ${isDragActive ? 'border-[#0284C7] bg-sky-50' : 'border-slate-300 hover:border-[#0284C7] hover:bg-slate-50/50'}
              `}
            >
              <input {...getInputProps()} />
              <Upload className={`w-10 h-10 mb-4 ${isDragActive ? 'text-[#0284C7]' : 'text-slate-400'}`} />
              <p className="text-slate-700 font-semibold text-center">
                Prevucite fajl ovde ili kliknite da odaberete
              </p>
              <p className="text-slate-500 text-sm mt-2 text-center">
                Podržani formati: Excel (.xlsx, .xls, .xlsm) i CSV (.csv, .cs)
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#0284C7] bg-[#E0F2FE] border border-sky-100 px-3 py-1 rounded-full">
                    Pronađeno {dataPreview.length} redova
                  </span>
                </div>
                <button
                  onClick={() => setDataPreview([])}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  Učitaj drugi fajl
                </button>
              </div>

              <div
                data-lenis-prevent
                className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-slate-50 mb-6 premium-scrollbar"
              >
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 sticky top-0 border-b border-slate-200">
                    <tr>
                      {headers.map((key) => (
                        <th key={key} className="px-4 py-3 text-slate-700 font-semibold">
                          {headerMap[key] || key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataPreview.slice(0, 50).map((row, i) => (
                      <tr 
                        key={i} 
                        className="hover:bg-slate-100/50"
                      >
                        {headers.map((key, j) => {
                          const val = row[key as keyof ImportPatient]
                          if (key === 'phone' && val === '/') {
                            return (
                              <td key={j} className="px-4 py-3 text-slate-400 font-medium italic">
                                /
                              </td>
                            )
                          }
                          if (key === 'appointment_date' && val) {
                            try {
                              const [dPart, tPart] = String(val).split('T')
                              if (dPart && tPart) {
                                const [y, m, d] = dPart.split('-')
                                return (
                                  <td key={j} className="px-4 py-3 text-emerald-600 font-medium">
                                    {`${d}.${m}.${y}. u ${tPart}`}
                                  </td>
                                )
                              }
                            } catch {}
                          }
                          return (
                            <td key={j} className="px-4 py-3 text-slate-700">
                              {val === null || val === undefined || val === '' ? (
                                <span className="text-slate-400">-</span>
                              ) : String(val)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="mb-4 flex items-center gap-2 text-red-750 bg-red-50 border border-red-200 p-3 rounded-xl shrink-0">
                  <AlertCircle size={16} />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 shrink-0">
                <button
                  onClick={onClose}
                  disabled={isUploading}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Otkaži
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading || validRowsCount === 0}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#0284C7] hover:bg-sky-600 text-white transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Započni uvoz ({validRowsCount})
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
