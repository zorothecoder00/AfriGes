import { getToken } from "next-auth/jwt"   
import { NextRequest, NextResponse } from "next/server"

const secret = process.env.NEXTAUTH_SECRET  

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret })
  const { pathname } = request.nextUrl  

  // Redirection vers /login si l'utilisateur n'est pas connecté
  if (!token) {
    if (pathname.startsWith("/dashboard/admin") || pathname.startsWith("/dashboard/user")) {
      return NextResponse.redirect(new URL("/auth/login", request.url))
    }  
  }
   
  const role = token?.role                           

  // Admin/Super_admin qui tente d'acceder a /dashboard/user → redirection vers /dashboard/admin
  if (pathname.startsWith("/dashboard/user") && (role === "ADMIN" || role === "SUPER_ADMIN")) {
    return NextResponse.redirect(new URL("/dashboard/admin", req.url));
  }

  // User qui tente d'acceder a /dashboard/admin → redirection vers /dashboard/user
  if (pathname.startsWith("/dashboard/admin") && role === "USER") {
    return NextResponse.redirect(new URL("/dashboard/user", req.url));
  }

  return NextResponse.next()
}

// Définir les routes protégées
export const config = {
  matcher: ["/dashboard/:path*"],
};
