'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
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

  // Lazy-load existing files from Supabase Storage
  useEffect(() => {
    let active = true
    const fetchFiles = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from('xrays')
        .list(`patients/${patientId}`, { sortBy: { column: 'created_at', order: 'desc' } })

      if (!active) return

      if (!error && data) {
        const loaded = await Promise.all(
          data
            .filter(f => f.name !== '.emptyFolderPlaceholder')
            .map(async f => {
              const path = `patients/${patientId}/${f.name}`
              const { data: urlData } = supabase.storage.from('xrays').getPublicUrl(path)
              return {
                name: f.name,
                url: urlData.publicUrl,
                type: f.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
                uploadedAt: f.created_at ?? new Date().toISOString(),
                path,
              }
            })
        )
        if (active) {
          setFiles(loaded)
        }
      }
      if (active) {
        setHasLoaded(true)
        setIsLoading(false)
      }
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

    const supabase = createClient()
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

      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `patients/${patientId}/${timestamp}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('xrays')
        .upload(path, file, { upsert: false, contentType: file.type })

      if (uploadError) {
        setError(`Greška pri uploadu: ${uploadError.message}`)
        continue
      }

      const { data: urlData } = supabase.storage.from('xrays').getPublicUrl(path)
      newFiles.push({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        path,
      })
    }

    setFiles(prev => [...newFiles, ...prev])
    setUploading(false)
  }

  const handleDelete = async (file: XRayFile) => {
    const supabase = createClient()
    await supabase.storage.from('xrays').remove([file.path])
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
            ? 'border-sky-400 bg-sky-500/10'
            : 'border-white/10 hover:border-white/25 bg-slate-950/50 hover:bg-slate-900/50'
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
          <Loader2 size={32} className="text-sky-400 animate-spin" />
        ) : (
          <Upload size={28} className="text-slate-500" />
        )}
        <div className="text-center">
          <p className="text-slate-300 text-sm font-medium">
            {uploading ? 'Upload u toku...' : 'Prevuci RTG/Ortopan snimak ovde'}
          </p>
          <p className="text-slate-600 text-xs mt-1">PNG, JPEG, PDF · Max {MAX_SIZE_MB}MB po fajlu</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      {/* Gallery */}
      {isLoading ? (
        <div className="text-center py-6 text-slate-500 text-sm">Učitavanje snimaka...</div>
      ) : files.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <AnimatePresence>
            {files.map(file => (
              <motion.div
                key={file.path}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative bg-slate-900 border border-white/10 rounded-xl overflow-hidden aspect-square"
              >
                {file.type === 'application/pdf' ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4">
                    <FileIcon size={32} className="mb-2" />
                    <p className="text-xs text-center truncate w-full">{file.name}</p>
                  </div>
                ) : (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                )}
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {file.type !== 'application/pdf' && (
                    <button
                      onClick={e => { e.stopPropagation(); setZoomedImage(file) }}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                    >
                      <ZoomIn size={16} />
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(file) }}
                    className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-xl text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Date badge */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                  <p className="text-slate-400 text-xs truncate">{formatDate(file.uploadedAt)}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : hasLoaded ? (
        <div className="text-center py-8 text-slate-600 text-sm">
          <ImageIcon size={24} className="mx-auto mb-2 opacity-40" />
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
            className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setZoomedImage(null)}
          >
            <button
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white"
              onClick={() => setZoomedImage(null)}
            >
              <X size={20} />
            </button>
            <img
              src={zoomedImage.url}
              alt={zoomedImage.name}
              className="max-w-full max-h-[90vh] rounded-2xl object-contain"
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
