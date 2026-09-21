import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/decaissements/beneficiaires?q=
 * Recherche de membres (nom, prénom, téléphone) pour désigner le bénéficiaire d'une sortie de
 * caisse (salaire, avance, carburant…). Réservé aux profils qui enregistrent des sorties de caisse
 * ou contrôlent les décaissements : Admin, Caissier, RPV, Chef d'agence, Comptable, Chef comptable.
 */
const ROLES_AUTORISES = ["CAISSIER", "RESPONSABLE_POINT_DE_VENTE", "CHEF_AGENCE", "COMPTABLE", "CHEF_COMPTABLE"];

export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const estAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    if (!estAdmin && !ROLES_AUTORISES.includes(session.user.gestionnaireRole ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const q = (new URL(req.url).searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json({ data: [] });

    const membres = await prisma.user.findMany({
      where: {
        etat: "ACTIF",
        OR: [
          { nom: { contains: q, mode: "insensitive" } },
          { prenom: { contains: q, mode: "insensitive" } },
          { telephone: { contains: q } },
        ],
      },
      select: { id: true, nom: true, prenom: true, telephone: true, gestionnaire: { select: { role: true } } },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      take: 10,
    });

    return NextResponse.json({
      data: membres.map((m) => ({
        id: m.id, nom: m.nom, prenom: m.prenom, telephone: m.telephone, roleGestionnaire: m.gestionnaire?.role ?? null,
      })),
    });
  } catch (error) {
    console.error("GET /decaissements/beneficiaires:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
