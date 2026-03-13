import { NextResponse, type NextRequest } from 'next/server'

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const dotIndex = token.lastIndexOf('.')
    if (dotIndex === -1) return false

    const payloadB64 = token.slice(0, dotIndex)
    const sig = token.slice(dotIndex + 1)
    if (!payloadB64 || !sig) return false

    // Decode base64url using Web API (works in Edge runtime)
    const padding = '='.repeat((4 - (payloadB64.length % 4)) % 4)
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/') + padding
    const payload = atob(base64)

    const encoder = new TextEncoder()
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      encoder.encode(payload)
    )

    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return sig === expectedSig
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks')
  ) {
    return NextResponse.next()
  }

  const authSecret = process.env.AUTH_SECRET
  const token = request.cookies.get('auth-token')?.value
  const isAuthenticated = !!(authSecret && token && await verifyToken(token, authSecret))
  const isLoginPage = pathname === '/login'

  if (!isAuthenticated && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isAuthenticated && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
