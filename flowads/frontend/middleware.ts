import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'

function verifyToken(token: string, secret: string): boolean {
  try {
    const dotIndex = token.lastIndexOf('.')
    if (dotIndex === -1) return false

    const payloadB64 = token.slice(0, dotIndex)
    const sig = token.slice(dotIndex + 1)
    if (!payloadB64 || !sig) return false

    const payload = Buffer.from(payloadB64, 'base64url').toString()
    const expectedSig = createHmac('sha256', secret).update(payload).digest('hex')

    // Constant-time comparison to prevent timing attacks
    if (sig.length !== expectedSig.length) return false
    const sigBuf = Buffer.from(sig, 'hex')
    const expectedBuf = Buffer.from(expectedSig, 'hex')
    if (sigBuf.length !== expectedBuf.length) return false
    return timingSafeEqual(sigBuf, expectedBuf)
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow auth API routes and public webhooks
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks')
  ) {
    return NextResponse.next()
  }

  const authSecret = process.env.AUTH_SECRET
  const token = request.cookies.get('auth-token')?.value
  const isAuthenticated = !!(authSecret && token && verifyToken(token, authSecret))
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
