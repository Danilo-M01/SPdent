import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { level = 'INFO', message, component, payload } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const validLevels = ['INFO', 'WARN', 'CRITICAL']
    const safeLevel = validLevels.includes(level) ? level : 'INFO'

    const supabase = await createClient()

    // Verify that the caller is authenticated (defense-in-depth)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase.from('system_logs').insert({
      level: safeLevel,
      message: message.slice(0, 2000),
      component: component ? String(component).slice(0, 200) : null,
      payload: payload ?? null,
    })

    if (error) {
      console.error('[/api/admin/log] insert error:', error.message)
      return NextResponse.json({ error: 'DB write failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/admin/log] unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
