import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

const secret = process.env.NEXTAUTH_SECRET    

// Mapping RoleGestionnaire → chemin dashboard
const gestionnaireDashboardMap: Record<string, string> = {
  RESPONSABLE_POINT_DE_VENTE: "/dashboard/user/responsablesPointDeVente",
  CHEF_AGENCE: "/dashboard/user/chefAgence",
  RESPONSABLE_COMMUNAUTE: "/dashboard/user/chefAgence",
  REVENDEUR: "/dashboard/user/revendeurs",
  AGENT_LOGISTIQUE_APPROVISIONNEMENT: "/dashboard/user/logistiquesApprovisionnements",
  MAGAZINIER: "/dashboard/user/magasiniers",
  CAISSIER: "/dashboard/user/caissiers",
  COMPTABLE: "/dashboard/user/comptables",
  AGENT_TERRAIN: "/dashboard/user/agentsTerrain",
  AUDITEUR_INTERNE: "/dashboard/user/auditeursInterne",
  ACTIONNAIRE: "/dashboard/user/actionnaires",
  RESPONSABLE_VENTE_CREDIT: "/dashboard/user/responsablesVenteCredit",
  // Membres stricts de commission de gouvernance → portail gouvernance uniquement
  PRESIDENT_COMMISSION_RIA: "/dashboard/user/gouvernance",
  RAPPORTEUR_COMMISSION_RIA: "/dashboard/user/gouvernance",
}

// Pages du dashboard admin ouvertes à certains gestionnaires (double casquette).
// Le proxy n'autorise QUE la navigation ; l'autorisation fine reste appliquée en
// aval par les capacités (ex. authCompteCourant : READ/DEPOSIT/VALIDATE selon le
// rôle). Ex. : le caissier initie un retrait CC, le chef d'agence le valide.
const sharedAdminPaths: { prefix: string; roles: string[] }[] = [
  {
    prefix: "/dashboard/admin/comptes-courants",
    roles: ["CHEF_AGENCE", "CAISSIER", "RESPONSABLE_ECONOMIQUE", "AGENT_TERRAIN", "AUDITEUR_INTERNE"],
  },
]

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret })
  const { pathname } = request.nextUrl

  // Redirection vers /login si l'utilisateur n'est pas connecté
  if (!token) {
    if (pathname.startsWith("/dashboard/admin") || pathname.startsWith("/dashboard/user")) {
      return NextResponse.redirect(new URL("/auth/login", request.url))
    }
  }

  // Session révoquée (suspendu ou force_disconnect) → login
  if (token?.error === "SESSION_INVALID") {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("sessionExpired", "true")
    return NextResponse.redirect(loginUrl)
  }

  // Doit changer son mot de passe → page dédiée
  if (
    token?.mustChangePassword &&
    !pathname.startsWith("/auth/change-password") &&
    !pathname.startsWith("/api/user/change-password") &&
    !pathname.startsWith("/api/auth")
  ) {
    return NextResponse.redirect(new URL("/auth/change-password", request.url))
  }

  const role = token?.role

  // ── Blocage mutations en mode viewAs ────────────────────────────────────────
  // Un admin avec le cookie viewAs ne peut pas écrire via les APIs gestionnaires
  const GESTIONNAIRE_API_PREFIXES = [
    "/api/caissier",
    "/api/rpv",
    "/api/chef-agence",
    "/api/magasinier",
    "/api/logistique",
    "/api/agentTerrain",
    "/api/comptable",
    "/api/auditeur",
    "/api/actionnaire",
    "/api/rvc",
  ];
  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    (role === "ADMIN" || role === "SUPER_ADMIN") &&
    GESTIONNAIRE_API_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    const viewAsCookie = request.cookies.get("viewAs")?.value;
    if (viewAsCookie) {
      return new NextResponse(
        JSON.stringify({ error: "Action impossible en mode lecture" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Admin/Super_admin qui tente d'acceder a /dashboard/user
  // → autoriser si cookie viewAs présent (mode lecture gestionnaire)
  // → sinon rediriger vers /dashboard/admin
  if (pathname.startsWith("/dashboard/user") && (role === "ADMIN" || role === "SUPER_ADMIN")) {
    const viewAsCookie = request.cookies.get("viewAs")?.value;
    if (!viewAsCookie) {
      return NextResponse.redirect(new URL("/dashboard/admin", request.url));
    }
    // Cookie viewAs présent → laisser passer (mode lecture)
  }

  // User qui tente d'acceder a /dashboard/admin → redirection vers son dashboard gestionnaire
  if (pathname.startsWith("/dashboard/admin") && role === "USER") {
    const gestionnaireRole = token?.gestionnaireRole as string | undefined
    // Exception : pages admin partagées ouvertes à certains gestionnaires (ex. comptes courants).
    const shared = sharedAdminPaths.find((s) => pathname.startsWith(s.prefix))
    if (shared && gestionnaireRole && shared.roles.includes(gestionnaireRole)) {
      return NextResponse.next()
    }
    const destination = (gestionnaireRole && gestionnaireDashboardMap[gestionnaireRole]) || "/dashboard/user"
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // User sur /dashboard/user → vérifier qu'il accède uniquement à SON dashboard
  if (pathname.startsWith("/dashboard/user") && role === "USER") {
    const gestionnaireRole = token?.gestionnaireRole as string | undefined
    const allowedPath = (gestionnaireRole && gestionnaireDashboardMap[gestionnaireRole]) || null

    // /dashboard/user exactement → rediriger vers son dashboard spécifique
    if (pathname === "/dashboard/user" || pathname === "/dashboard/user/") {
      if (allowedPath) {
        return NextResponse.redirect(new URL(allowedPath, request.url));
      }
      // Pas de rôle gestionnaire → laisser passer sur /dashboard/user
      return NextResponse.next()
    }

    // Pages communes accessibles à tous les gestionnaires.
    // Les portails RIA (investisseur & gouvernance) sont ouverts à n'importe quel
    // gestionnaire à double casquette : un caissier/comptable… peut aussi détenir
    // un profil investisseur ou siéger dans une commission. L'autorisation réelle
    // est appliquée en aval (authInvestisseurRIA exige un profilRIA, authCommissionRIA
    // un siège actif) — sans accès, les pages/API renvoient simplement vide.
    const commonPaths = [
      "/dashboard/user/notifications",
      "/dashboard/user/investisseurs",
      "/dashboard/user/gouvernance",
    ];
    const isCommonPath = commonPaths.some(p => pathname.startsWith(p));

    // Si le user tente d'accéder à un dashboard qui n'est pas le sien → redirection
    if (allowedPath && !isCommonPath && !pathname.startsWith(allowedPath)) {
      return NextResponse.redirect(new URL(allowedPath, request.url));
    }
  }

  return NextResponse.next()
}

// Définir les routes protégées
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/auth/change-password",
    "/api/caissier/:path*",
    "/api/rpv/:path*",
    "/api/chef-agence/:path*",
    "/api/magasinier/:path*",
    "/api/logistique/:path*",
    "/api/agentTerrain/:path*",
    "/api/comptable/:path*",
    "/api/auditeur/:path*",
    "/api/actionnaire/:path*",
    "/api/rvc/:path*",
  ],
};
