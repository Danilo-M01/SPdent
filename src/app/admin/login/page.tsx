'use client'

import Image from 'next/image'
import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { signIn } from '../actions'
import type { ActionResult } from '../actions'

export default function AdminLoginPage() {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    signIn,
    null
  )
  const router = useRouter()

  useEffect(() => {
    if (state?.success) {
      router.push('/admin')
    }
  }, [state, router])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-sky-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo-spdent.png"
            alt="SP DENT"
            width={240}
            height={96}
            className="object-contain brightness-0 invert transition-transform hover:scale-105 duration-300"
            priority
          />
        </div>

        {/* Glass card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-8 shadow-2xl shadow-black/50">
          <form action={formAction} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-300 mb-2">
                Email adresa
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="admin@spdent.rs"
                className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all duration-200"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-300 mb-2">
                Lozinka
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all duration-200"
              />
            </div>

            {/* Error message */}
            {state?.error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
              >
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span className="text-red-400 text-sm">{state.error}</span>
              </motion.div>
            )}

            {/* Submit */}
            <motion.button
              id="login-submit-btn"
              type="submit"
              disabled={isPending}
              whileHover={{ scale: isPending ? 1 : 1.01 }}
              whileTap={{ scale: isPending ? 1 : 0.99 }}
              className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm tracking-wide mt-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Prijava...
                </span>
              ) : (
                'Prijavi se'
              )}
            </motion.button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          SP DENT &copy; {new Date().getFullYear()} — Pristup samo za ovlašćeno osoblje
        </p>
      </motion.div>
    </div>
  )
}
