export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 pt-20 lg:p-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-8 w-48 bg-slate-800 rounded-xl" />
            <div className="h-6 w-36 bg-slate-900 rounded-lg" />
          </div>
          <div className="h-4 w-64 bg-slate-900 rounded-lg mt-2" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-20 bg-slate-900 rounded-xl" />
          <div className="h-10 w-32 bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-4xl">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-slate-900/40 border border-white/5 rounded-xl p-4 flex items-center justify-between gap-4 h-20"
          >
            <div className="flex-1 space-y-2">
              <div className="h-3 w-20 bg-slate-800 rounded" />
              <div className="h-6 w-12 bg-slate-800 rounded" />
            </div>
            <div className="h-10 w-10 bg-slate-900 rounded-lg border border-white/5" />
          </div>
        ))}
      </div>

      {/* Search + Sort Skeleton */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full h-11 bg-slate-900/40 border border-white/5 rounded-xl" />
        <div className="w-full md:w-48 h-11 bg-slate-900/40 border border-white/5 rounded-xl" />
      </div>

      {/* Grid of cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 flex flex-col gap-4 h-48"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-2 flex-1">
                <div className="h-5 w-32 bg-slate-800 rounded-md" />
                <div className="h-3.5 w-24 bg-slate-900 rounded-md" />
              </div>
              <div className="h-6 w-16 bg-slate-900 rounded-md border border-white/5" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-40 bg-slate-800 rounded-md" />
              <div className="h-3 w-28 bg-slate-900 rounded-md" />
            </div>
            <div className="h-10 bg-slate-900/60 rounded-xl mt-auto border border-white/5" />
          </div>
        ))}
      </div>
    </div>
  )
}
