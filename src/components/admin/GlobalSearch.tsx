'use client'

import { Search, X } from 'lucide-react'

interface GlobalSearchProps {
  query: string
  onQueryChange: (q: string) => void
  totalCount: number
}

export default function GlobalSearch({ query, onQueryChange, totalCount }: GlobalSearchProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1 max-w-lg">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white pointer-events-none"
        />
        <input
          id="patient-search-input"
          type="search"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Pretraži po imenu ili broju telefona..."
          className="w-full bg-slate-900/60 backdrop-blur-sm border border-white/5 hover:border-white/10 focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200"
        />
        {query && (
          <button
            onClick={() => onQueryChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
            aria-label="Obriši pretragu"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <p className="text-slate-500 text-sm shrink-0">
        {totalCount} {totalCount === 1 ? 'pacijent' : 'pacijenata'}
      </p>
    </div>
  )
}
