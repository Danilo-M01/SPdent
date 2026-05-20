'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { signOut } from '@/app/admin/actions'
import {
  LayoutDashboard,
  CalendarDays,
  LogOut,
  Users,
  Stethoscope,
  Layers,
  ChevronDown,
} from 'lucide-react'
import { useState } from 'react'

interface AdminSidebarProps {
  userEmail: string
}

export default function AdminSidebar({ userEmail }: AdminSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentCategory = searchParams.get('category')
  const [patientsOpen, setPatientsOpen] = useState(
    pathname === '/admin' || !pathname.startsWith('/admin/termini')
  )

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href)

  const isCategoryActive = (cat: string | null) => {
    if (pathname !== '/admin') return false
    return currentCategory === cat
  }

  const navLinkClass = (active: boolean) =>
    `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
      active
        ? 'bg-sky-500/15 text-sky-300 border border-sky-500/20'
        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
    }`

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-64 shrink-0 h-screen flex flex-col bg-slate-900/80 backdrop-blur-xl border-r border-white/5"
    >
      {/* Brand */}
      <div className="px-6 py-6 border-b border-white/5 flex items-center justify-center">
        <div className="relative w-36 h-12">
          <Image
            src="/logo-spdent.png"
            alt="SP DENT Logo"
            fill
            className="object-contain brightness-0 invert"
            priority
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">

        {/* Kontrolna tabla */}
        <Link
          href="/admin"
          className={navLinkClass(isActive('/admin', true) && !currentCategory)}
        >
          <LayoutDashboard size={18} className="shrink-0" />
          Kontrolna tabla
          {isActive('/admin', true) && !currentCategory && (
            <motion.div layoutId="sidebar-active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />
          )}
        </Link>

        {/* Termini */}
        <Link
          href="/admin/termini"
          className={navLinkClass(isActive('/admin/termini'))}
        >
          <CalendarDays size={18} className="shrink-0" />
          Termini
          {isActive('/admin/termini') && (
            <motion.div layoutId="sidebar-active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />
          )}
        </Link>

        {/* Pacijenti — collapsible section */}
        <div className="pt-2">
          <button
            onClick={() => setPatientsOpen(!patientsOpen)}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors"
          >
            <span>Pacijenti</span>
            <ChevronDown
              size={14}
              className={`ml-auto transition-transform duration-200 ${patientsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {patientsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-1 space-y-1 pl-2"
            >
              {/* Svi pacijenti */}
              <Link
                href="/admin"
                className={navLinkClass(isCategoryActive(null) && pathname === '/admin' && !currentCategory)}
              >
                <Users size={16} className="shrink-0 opacity-70" />
                Svi pacijenti
              </Link>

              {/* Regularni */}
              <Link
                href="/admin?category=regular"
                className={navLinkClass(isCategoryActive('regular'))}
              >
                <Users size={16} className="shrink-0 opacity-70" />
                Regularni
              </Link>

              {/* Implantologija */}
              <Link
                href="/admin?category=implant"
                className={navLinkClass(isCategoryActive('implant'))}
              >
                <Stethoscope size={16} className="shrink-0 opacity-70" />
                Implantologija
              </Link>

              {/* Protetika */}
              <Link
                href="/admin?category=proteza"
                className={navLinkClass(isCategoryActive('proteza'))}
              >
                <Layers size={16} className="shrink-0 opacity-70" />
                Protetika
              </Link>
            </motion.div>
          )}
        </div>
      </nav>

      {/* User info + Sign out */}
      <div className="px-3 py-4 border-t border-white/5 space-y-2">
        <div className="px-3 py-2 rounded-xl bg-slate-800/50">
          <p className="text-slate-500 text-xs mb-0.5">Prijavljeni kao</p>
          <p className="text-slate-300 text-xs font-medium truncate">{userEmail}</p>
        </div>
        <form action={signOut}>
          <button
            id="admin-signout-btn"
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
          >
            <LogOut size={16} className="shrink-0" />
            Odjavi se
          </button>
        </form>
      </div>
    </motion.aside>
  )
}
