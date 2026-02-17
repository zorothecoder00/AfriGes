import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

const secret = process.env.NEXTAUTH_SECRET

// Mapping RoleGestionnaire → chemin dashboard
const gestionnaireDashboardMap: Record<string, string> = {
  RESPONSABLE_POINT_DE_VENTE: "/dashboard/user/responsablesPointDeVente",
  RESPONSABLE_COMMUNAUTE: "/dashboard/user/responsablesCommunaute",
  REVENDEUR: "/dashboard/user/revendeurs",
  AGENT_LOGISTIQUE_APPROVISIONNEMENT: "/dashboard/user/logistiquesApprovisionnements",
  MAGAZINIER: "/dashboard/user/magasiniers",
  CAISSIER: "/dashboard/user/caissiers",
  COMPTABLE: "/dashboard/user/comptables",
  AGENT_TERRAIN: "/dashboard/user/agentsTerrain",
}

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
    return NextResponse.redirect(new URL("/dashboard/admin", request.url));
  }

  // User qui tente d'acceder a /dashboard/admin → redirection vers son dashboard gestionnaire
  if (pathname.startsWith("/dashboard/admin") && role === "USER") {
    const gestionnaireRole = token?.gestionnaireRole as string | undefined
    const destination = (gestionnaireRole && gestionnaireDashboardMap[gestionnaireRole]) || "/dashboard/user"
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // User sur /dashboard/user exactement → rediriger vers son dashboard gestionnaire spécifique
  if ((pathname === "/dashboard/user" || pathname === "/dashboard/user/") && role === "USER") {
    const gestionnaireRole = token?.gestionnaireRole as string | undefined
    if (gestionnaireRole && gestionnaireDashboardMap[gestionnaireRole]) {
      return NextResponse.redirect(new URL(gestionnaireDashboardMap[gestionnaireRole], request.url));
    }
  }

  return NextResponse.next()
}

// Définir les routes protégées
export const config = {
  matcher: ["/dashboard/:path*"],
};
