'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { signOut } from '@/app/admin/actions'
import {
  LayoutDashboard,
  CalendarDays,
  LogOut,
  Users,
  Stethoscope,
  Layers,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

interface AdminSidebarProps {
  userEmail: string
}

export default function AdminSidebar({ userEmail }: AdminSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentCategory = searchParams.get('category')
  const [isMobileOpen, setIsMobileOpen] = useState(false)
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

  const categoryNavLinkClass = (active: boolean) =>
    `group flex items-center gap-3 px-3 py-2.5 transition-all duration-200 ${
      active
        ? 'text-sky-400 font-bold text-base bg-transparent border-none'
        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 text-sm font-medium'
    }`

  const handleLinkClick = () => {
    setIsMobileOpen(false)
  }

  return (
    <>
      {/* Mobile Header zaglavlje (prikazuje se samo na ekranima manjim od lg) */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-slate-950/80 backdrop-blur-md border-b border-white/5 z-30 flex items-center justify-between px-6 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8">
            <Image
              src="/logo-spdent.png"
              alt="SP DENT Logo"
              fill
              className="object-contain brightness-0 invert"
              priority
            />
          </div>
          <span className="text-white font-bold text-lg tracking-wide">SP DENT</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2.5 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          {isMobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Zatamnjeni overlay (štiti pozadinu na mobilnim uređajima) */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar kontejner */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 z-50 flex flex-col bg-slate-900/95 backdrop-blur-2xl border-r border-white/5 shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:h-screen lg:w-64 lg:bg-slate-900/80 lg:shadow-none lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand i logo */}
        <div className="px-6 py-6 border-b border-white/5 flex items-center justify-between lg:justify-center">
          <div className="relative w-32 h-10 lg:w-36 lg:h-12">
            <Image
              src="/logo-spdent.png"
              alt="SP DENT Logo"
              fill
              className="object-contain brightness-0 invert"
              priority
            />
          </div>
          {/* Dugme X za zatvaranje u samom sidebaru na mobilnom */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 lg:hidden cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigacija */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto premium-scrollbar">
          {/* Kontrolna tabla */}
          <Link
            href="/admin"
            prefetch={true}
            onClick={handleLinkClick}
            className={navLinkClass(isActive('/admin', true) && !currentCategory)}
          >
            <LayoutDashboard size={18} className="shrink-0" />
            Kontrolna tabla
            {isActive('/admin', true) && !currentCategory && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />
            )}
          </Link>

          {/* Termini */}
          <Link
            href="/admin/termini"
            prefetch={true}
            onClick={handleLinkClick}
            className={navLinkClass(isActive('/admin/termini'))}
          >
            <CalendarDays size={18} className="shrink-0" />
            Termini
            {isActive('/admin/termini') && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />
            )}
          </Link>

          {/* Pacijenti — collapsible sekcija */}
          <div className="pt-2">
            <button
              onClick={() => setPatientsOpen(!patientsOpen)}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors"
            >
              <span>Pacijenti</span>
              <ChevronDown
                size={14}
                className={`ml-auto transition-transform duration-200 ${
                  patientsOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {patientsOpen && (
              <div className="mt-1 space-y-1 pl-2">
                {/* Svi pacijenti */}
                <Link
                  href="/admin"
                  prefetch={true}
                  onClick={handleLinkClick}
                  className={categoryNavLinkClass(
                    isCategoryActive(null) && pathname === '/admin' && !currentCategory
                  )}
                >
                  <Users size={16} className={`shrink-0 transition-all ${
                    isCategoryActive(null) && pathname === '/admin' && !currentCategory
                      ? 'text-sky-400 opacity-100 scale-110'
                      : 'opacity-70'
                  }`} />
                  Svi pacijenti
                </Link>

                {/* Regularni */}
                <Link
                  href="/admin?category=regular"
                  prefetch={true}
                  onClick={handleLinkClick}
                  className={categoryNavLinkClass(isCategoryActive('regular'))}
                >
                  <Users size={16} className={`shrink-0 transition-all ${
                    isCategoryActive('regular')
                      ? 'text-sky-400 opacity-100 scale-110'
                      : 'opacity-70'
                  }`} />
                  Regularni
                </Link>

                {/* Implantologija */}
                <Link
                  href="/admin?category=implant"
                  prefetch={true}
                  onClick={handleLinkClick}
                  className={categoryNavLinkClass(isCategoryActive('implant'))}
                >
                  <Stethoscope size={16} className={`shrink-0 transition-all ${
                    isCategoryActive('implant')
                      ? 'text-sky-400 opacity-100 scale-110'
                      : 'opacity-70'
                  }`} />
                  Implantologija
                </Link>

                {/* Protetika */}
                <Link
                  href="/admin?category=proteza"
                  prefetch={true}
                  onClick={handleLinkClick}
                  className={categoryNavLinkClass(isCategoryActive('proteza'))}
                >
                  <Layers size={16} className={`shrink-0 transition-all ${
                    isCategoryActive('proteza')
                      ? 'text-sky-400 opacity-100 scale-110'
                      : 'opacity-70'
                  }`} />
                  Protetika
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Podaci o korisniku i Odjava */}
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
      </aside>
    </>
  )
}
