'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { uploadXRay, deleteXRay, listXRays } from '@/app/admin/actions'
import { Upload, ImageIcon, FileIcon, ZoomIn, X, Loader2 } from 'lucide-react'

interface XRayFile {
  name: string
  url: string
  type: string
  uploadedAt: string
  path: string
}

interface XRayUploaderProps {
  patientId: string
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
const MAX_SIZE_MB = 20

export default function XRayUploader({ patientId }: XRayUploaderProps) {
  const [files, setFiles] = useState<XRayFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<XRayFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Zoom/Rotate/Pan states for full screen view
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 })
  const dragStart = useRef({ x: 0, y: 0 })

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 4))
  const handleZoomOut = () => setScale(prev => {
    const next = Math.max(prev - 0.25, 0.25)
    if (next <= 1) setPanPosition({ x: 0, y: 0 })
    return next
  })
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)
  const handleReset = () => {
    setScale(1)
    setRotation(0)
    setPanPosition({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return
    setIsDraggingImage(true)
    dragStart.current = { x: e.clientX - panPosition.x, y: e.clientY - panPosition.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingImage || scale <= 1) return
    const nextX = e.clientX - dragStart.current.x
    const nextY = e.clientY - dragStart.current.y
    setPanPosition({ x: nextX, y: nextY })
  }

  const handleMouseUpOrLeave = () => {
    setIsDraggingImage(false)
  }

  // Lazy-load existing files from Supabase Storage
  useEffect(() => {
    let active = true
    const fetchFiles = async () => {
      const result = await listXRays(patientId)
      if (!active) return

      if (result.success && result.files) {
        setFiles(result.files)
      } else {
        setError(result.error || 'Greška pri učitavanju snimaka.')
      }
      setHasLoaded(true)
      setIsLoading(false)
    }

    fetchFiles()

    return () => {
      active = false
    }
  }, [patientId])

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setError(null)
    setUploading(true)

    const newFiles: XRayFile[] = []

    for (const file of Array.from(fileList)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Dozvoljeni formati: PNG, JPEG, PDF.')
        continue
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`Fajl "${file.name}" premašuje ${MAX_SIZE_MB}MB limit.`)
        continue
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('patientId', patientId)

      const result = await uploadXRay(formData)

      if (!result.success || !result.file) {
        setError(`Greška pri uploadu: ${result.error || 'Nepoznata greška'}`)
        continue
      }

      newFiles.push(result.file)
    }

    setFiles(prev => [...newFiles, ...prev])
    setUploading(false)
  }

  const handleDelete = async (file: XRayFile) => {
    const result = await deleteXRay(file.path)
    if (!result.success) {
      setError(`Greška pri brisanju: ${result.error || 'Nepoznata greška'}`)
      return
    }
    setFiles(prev => prev.filter(f => f.path !== file.path))
  }

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('sr-RS', {
      timeZone: 'Europe/Belgrade',
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(iso))

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files) }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl py-10 px-6 cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-[#0284C7] bg-sky-50'
            : 'border-slate-200 hover:border-slate-350 bg-slate-50 hover:bg-slate-100/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
        />
        {uploading ? (
          <Loader2 size={32} className="text-[#0284C7] animate-spin" />
        ) : (
          <Upload size={28} className="text-slate-400" />
        )}
        <div className="text-center">
          <p className="text-slate-700 text-sm font-semibold">
            {uploading ? 'Upload u toku...' : 'Prevuci RTG/Ortopan snimak ovde'}
          </p>
          <p className="text-slate-400 text-xs mt-1">PNG, JPEG, PDF · Max {MAX_SIZE_MB}MB po fajlu</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-red-750 font-medium text-sm">{error}</div>
      )}

      {/* Gallery */}
      {isLoading ? (
        <div className="text-center py-6 text-slate-650 text-sm font-semibold">Učitavanje snimaka...</div>
      ) : files.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <AnimatePresence>
            {files.map(file => (
              <motion.div
                key={file.path}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`group relative bg-white border border-slate-200 rounded-xl overflow-hidden aspect-square shadow-sm ${
                  file.type !== 'application/pdf' ? 'cursor-pointer hover:border-slate-350' : 'cursor-pointer hover:border-[#0284C7]/30'
                }`}
                onClick={() => {
                  if (file.type === 'application/pdf') {
                    window.open(file.url, '_blank')
                  } else {
                    setZoomedImage(file)
                  }
                }}
              >
                {file.type === 'application/pdf' ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 p-4">
                    <FileIcon size={32} className="mb-2 text-sky-600" />
                    <p className="text-xs text-center font-semibold truncate w-full">{file.name}</p>
                  </div>
                ) : (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                )}
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {file.type !== 'application/pdf' && (
                    <button
                      onClick={e => { e.stopPropagation(); setZoomedImage(file) }}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                      title="Uvećaj"
                    >
                      <ZoomIn size={16} />
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(file) }}
                    className="p-2 bg-red-500/20 hover:bg-red-500/45 rounded-xl text-red-200 transition-colors"
                    title="Obriši"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Date badge */}
                <div className="absolute bottom-0 left-0 right-0 bg-white/85 backdrop-blur-xs px-2 py-1">
                  <p className="text-slate-700 text-xs font-semibold truncate">{formatDate(file.uploadedAt)}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : hasLoaded ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          <ImageIcon size={24} className="mx-auto mb-2 opacity-30 text-slate-400" />
          Nema sačuvanih RTG snimaka za ovog pacijenta
        </div>
      ) : null}

      {/* Zoom modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-slate-950/95 flex flex-col items-center justify-center p-4 select-none"
            onClick={() => { setZoomedImage(null); handleReset() }}
          >
            {/* Top Bar with Info and Actions */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-[80]" onClick={e => e.stopPropagation()}>
              <div className="bg-slate-900/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-xl text-slate-300 text-xs font-medium max-w-[50%] truncate">
                {zoomedImage.name} ({formatDate(zoomedImage.uploadedAt)})
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900/80 backdrop-blur border border-white/10 p-1 rounded-xl gap-1">
                  <button
                    onClick={handleZoomOut}
                    disabled={scale <= 0.25}
                    className="w-8 h-8 flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-white rounded-lg transition-colors text-lg font-bold"
                    title="Umanji"
                  >
                    -
                  </button>
                  <span className="text-white text-xs px-1 min-w-[3rem] text-center font-medium">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    disabled={scale === 4}
                    className="w-8 h-8 flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-white rounded-lg transition-colors text-lg font-bold"
                    title="Uvećaj"
                  >
                    +
                  </button>
                  <div className="w-[1px] h-4 bg-white/10 mx-1" />
                  <button
                    onClick={handleRotate}
                    className="p-2 hover:bg-white/10 text-white rounded-lg transition-colors"
                    title="Rotiraj za 90°"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 16H19M20 20v-5h-5" /></svg>
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-2 py-1 hover:bg-white/10 text-white rounded-lg transition-colors text-xs font-medium"
                    title="Resetuj prikaz"
                  >
                    Reset
                  </button>
                </div>
                <button
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                  onClick={() => { setZoomedImage(null); handleReset() }}
                  title="Zatvori"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Image viewport */}
            <div 
              className="w-full h-full flex items-center justify-center overflow-hidden"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
            >
              <div 
                style={{
                  transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${scale}) rotate(${rotation}deg)`,
                  transition: isDraggingImage ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  cursor: scale > 1 ? (isDraggingImage ? 'grabbing' : 'grab') : 'default'
                }}
                className="max-w-[95vw] max-h-[95vh] flex items-center justify-center"
                onClick={e => e.stopPropagation()}
                onDoubleClick={() => {
                  if (scale > 1) {
                    handleReset()
                  } else {
                    setScale(2)
                  }
                }}
              >
                <img
                  src={zoomedImage.url}
                  alt={zoomedImage.name}
                  className="w-[90vw] h-[80vh] md:h-[85vh] rounded-xl object-contain pointer-events-none select-none"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
