import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/audit
 *
 * Filtres disponibles (query params) :
 *   entite    - filtre par entité (ex: ProfilRH, DemandeConge…)
 *   action    - filtre par action (CREATE, UPDATE, ARCHIVE…)
 *   userId    - filtre par utilisateur
 *   dateDebut - ISO date
 *   dateFin   - ISO date
 *   search    - recherche dans details (cast text)
 *   page      - page courante (défaut 1)
 *   limit     - nb par page (défaut 30, max 100)
 */

const RH_ENTITES = [
  "ProfilRH",
  "DocumentCollaborateur",
  "DocumentRHGenere",
  "DemandeConge",
  "SoldeConge",
  "EvaluationRH",
  "Formation",
  "ParticipationFormation",
  "HistoriquePoste",
  "PosteOuvert",
  "Candidature",
  "ProcedureDisciplinaire",
  "Mission",
  "FichePaie",
  "Pointage",
  "Absence",
  "Avantage",
  "RemboursementAvantage",
  "Competence",
  "CompetenceCollaborateur",
  "Carriere",
  "Horaire",
];

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const entite    = searchParams.get("entite")    ?? undefined;
    const action    = searchParams.get("action")    ?? undefined;
    const userId    = searchParams.get("userId")    ?? undefined;
    const dateDebut = searchParams.get("dateDebut") ?? undefined;
    const dateFin   = searchParams.get("dateFin")   ?? undefined;
    const search    = searchParams.get("search")    ?? undefined;
    const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit     = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "30")));
    const skip      = (page - 1) * limit;

    // Filtre sur les entités RH uniquement
    const entiteFilter = entite
      ? (RH_ENTITES.includes(entite) ? [entite] : [])
      : RH_ENTITES;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      entite: { in: entiteFilter },
    };

    if (action)    where.action   = action;
    if (userId)    where.userId   = parseInt(userId);
    if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin)   where.createdAt.lte = new Date(new Date(dateFin).setHours(23, 59, 59, 999));
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    // Filtrage post-requête sur search (recherche dans details JSON stringifié)
    const filtered = search
      ? logs.filter((l) => {
          const detailsStr = l.details ? JSON.stringify(l.details).toLowerCase() : "";
          const s = search.toLowerCase();
          return (
            detailsStr.includes(s) ||
            l.action.toLowerCase().includes(s) ||
            l.entite.toLowerCase().includes(s) ||
            `${l.user?.nom ?? ""} ${l.user?.prenom ?? ""}`.toLowerCase().includes(s)
          );
        })
      : logs;

    return NextResponse.json({
      data:  filtered,
      total: search ? filtered.length : total,
      page,
      limit,
      pages: Math.ceil((search ? filtered.length : total) / limit),
    });
  } catch (error) {
    console.error("GET /api/admin/rh/audit", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
