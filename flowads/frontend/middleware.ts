import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const secretKey = new TextEncoder().encode(secret)
    await jwtVerify(token, secretKey)
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/backend/webhooks') ||
    pathname.startsWith('/auth/')
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
