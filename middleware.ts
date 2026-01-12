// middleware.ts
import { getToken } from "next-auth/jwt"   
import { NextRequest, NextResponse } from "next/server"

const secret = process.env.NEXTAUTH_SECRET

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret })
  const { pathname } = request.nextUrl

  // Redirection vers /login si l'utilisateur n'est pas connecté
  if (!token) {
    if (pathname.startsWith("/dashboard/admin") || pathname.startsWith("/dashboard/user")) {
      return NextResponse.redirect(new URL("/login", request.url))
    }  
  }

  const role = token?.role  

  // Protection des routes /admin/**
  if (pathname.startsWith("/dashboard/admin")) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url))
    }
  }

  // Protection des routes /user/**
  if (pathname.startsWith("/dashboard/user")) {
    if (!role || !["USER", "ADMIN", "SUPER_ADMIN"].includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url))
    }
  }

  return NextResponse.next()
}

// Définir les routes protégées
export const config = {
  matcher: ["/dashboard/admin/:path*", "/dashboard/user/:path*"],
}
