import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminErrorBoundary from '@/components/admin/AdminErrorBoundary'

export const metadata: Metadata = {
  title: 'SP DENT Admin | Upravljanje Pacijentima',
  description: 'SP DENT Dental CRM',
  robots: { index: false, follow: false }, // Never index admin pages
}

/**
 * Admin shell layout — completely isolated from the public site layout.
 * Does NOT inherit <SmoothScroll> (Lenis) or <WhatsAppButton>.
 * This component validates the session server-side as a secondary check
 * (middleware is the primary gate, this provides defense-in-depth).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  return (
    <div className="bg-[#F8FAFC] text-[#0F172A] min-h-screen flex h-screen overflow-hidden">
      <AdminSidebar userEmail={user.email ?? 'admin@spdent.rs'} />
      <main className="flex-1 overflow-y-auto relative z-10 premium-scrollbar">
        <AdminErrorBoundary>
          {children}
        </AdminErrorBoundary>
      </main>
    </div>
  )
}
