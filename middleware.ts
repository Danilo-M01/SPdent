import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Security constants
// ---------------------------------------------------------------------------
const LOGIN_PATH = '/admin/login'
const DASHBOARD_PATH = '/admin'

/**
 * Hardened admin middleware.
 *
 * Security guarantees:
 * 1. PATH NORMALISATION — prevents path-traversal tricks like /admin/../admin/login
 * 2. SERVER-SIDE SESSION VALIDATION — uses getUser() which calls Supabase's Auth
 *    server to validate the JWT signature, NOT just reading the cookie payload.
 *    This means a manually crafted or tampered cookie is always rejected.
 * 3. SECURITY HEADERS — every admin response gets strict security headers to
 *    prevent clickjacking, sniffing, and XSS injection via iframes.
 * 4. NO BYPASS — any path under /admin that is not the login page will redirect
 *    to login if there is no valid server-verified session.
 * 5. FAIL-SAFE — if Supabase is unreachable, we redirect to login (never allow
 *    access) rather than crashing with a 500.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ------------------------------------------------------------------
  // 1. Skip middleware for public routes (performance fast-path)
  // ------------------------------------------------------------------
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next({ request })
  }

  // ------------------------------------------------------------------
  // 2. Normalise pathname to prevent path-traversal bypass attacks
  //    e.g. /admin/%2F..%2F..%2Flogin  →  decoded + resolved
  // ------------------------------------------------------------------
  let normPath: string
  try {
    normPath = new URL(request.url).pathname
  } catch {
    // Malformed URL — reject immediately
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url))
  }

  // Reject any path containing ".." segments (path traversal attempt)
  if (normPath.includes('..')) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url))
  }

  // ------------------------------------------------------------------
  // 3. Build Supabase client using the request cookies
  // ------------------------------------------------------------------
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ------------------------------------------------------------------
  // 4. SERVER-SIDE session validation (verifies JWT with Supabase Auth,
  //    not just reading the cookie — tampered cookies are rejected here)
  // ------------------------------------------------------------------
  let user = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error) {
      user = data.user
    }
  } catch (err) {
    console.error('[middleware] Supabase getUser() failed:', err)
    // user stays null → will be redirected to login below
  }

  // ------------------------------------------------------------------
  // 5. Routing logic
  // ------------------------------------------------------------------

  // Authenticated user visiting login → send to dashboard
  if (user && normPath === LOGIN_PATH) {
    const response = NextResponse.redirect(new URL(DASHBOARD_PATH, request.url))
    applySecurityHeaders(response)
    return response
  }

  // Unauthenticated user visiting any admin page → redirect to login
  if (!user && normPath !== LOGIN_PATH) {
    const loginUrl = new URL(LOGIN_PATH, request.url)
    // Preserve intended destination so login can redirect back after success
    if (normPath !== DASHBOARD_PATH) {
      loginUrl.searchParams.set('redirectTo', normPath)
    }
    const response = NextResponse.redirect(loginUrl)
    applySecurityHeaders(response)
    return response
  }

  // ------------------------------------------------------------------
  // 6. Authenticated — apply security headers and continue
  // ------------------------------------------------------------------
  applySecurityHeaders(supabaseResponse)
  return supabaseResponse
}

// ---------------------------------------------------------------------------
// Security headers applied to every admin response
// ---------------------------------------------------------------------------
function applySecurityHeaders(response: NextResponse) {
  // Prevent page from being embedded in an iframe (clickjacking)
  response.headers.set('X-Frame-Options', 'DENY')
  // Stop browser from MIME-sniffing the response
  response.headers.set('X-Content-Type-Options', 'nosniff')
  // Only send referrer to same origin
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // Disable caching of admin pages (prevents stale session pages in Back button)
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  response.headers.set('Pragma', 'no-cache')
  // Basic XSS protection for older browsers
  response.headers.set('X-XSS-Protection', '1; mode=block')
}

// ---------------------------------------------------------------------------
// Matcher: run ONLY on /admin and all sub-routes.
// _next/static, _next/image, favicon, public assets are never touched.
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
  ],
}
