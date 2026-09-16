import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * Comptes revendeurs B2B (CDC digitalisation §5.6). Un revendeur est un User
 * de rôle gestionnaire REVENDEUR (créé au préalable via le flux standard
 * /dashboard/admin/gestionnaires, comme tout autre gestionnaire) auquel on
 * attache ici un ProfilRevendeur : c'est cette création qui constitue la
 * "Fiche d'ouverture de compte revendeur" du CDC (imprimable ensuite via
 * FicheRevendeur.tsx, variante OUVERTURE).
 */

export const INCLUDE = {
  user: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
  pointDeVente: { select: { id: true, nom: true, code: true } },
  ouvertPar: { select: { id: true, nom: true, prenom: true } },
};

/** GET /api/admin/revendeurs — Query: statut? ; eligibles=true → users REVENDEUR sans compte encore ouvert */
export async function GET(req: Request) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);

    if (searchParams.get("eligibles") === "true") {
      const users = await prisma.user.findMany({
        where: { gestionnaire: { role: "REVENDEUR" }, profilRevendeur: null },
        select: { id: true, nom: true, prenom: true, email: true },
        orderBy: { nom: "asc" },
      });
      return NextResponse.json({ data: users });
    }

    const statut = searchParams.get("statut");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;

    const [profils, pdvs] = await Promise.all([
      prisma.profilRevendeur.findMany({ where, orderBy: { createdAt: "desc" }, include: INCLUDE }),
      prisma.pointDeVente.findMany({ where: { actif: true }, select: { id: true, nom: true, code: true }, orderBy: { nom: "asc" } }),
    ]);
    return NextResponse.json({ data: profils, pdvs });
  } catch (error) {
    console.error("GET /admin/revendeurs:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/revendeurs
 * Body: { userId, raisonSociale, nomCommercial?, nif?, rccm?, adresse?, ville?,
 *         contactNom?, contactTelephone?, contactEmail?, pointDeVenteId?,
 *         conditionsParticulieres? }
 */
export async function POST(req: Request) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const userId = Number(body.userId);
    if (!userId) return NextResponse.json({ error: "Utilisateur obligatoire" }, { status: 400 });
    if (!body.raisonSociale?.trim()) return NextResponse.json({ error: "Raison sociale obligatoire" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { gestionnaire: true, profilRevendeur: true },
    });
    if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    if (user.gestionnaire?.role !== "REVENDEUR") {
      return NextResponse.json({ error: "Cet utilisateur doit d'abord être nommé gestionnaire de rôle REVENDEUR" }, { status: 422 });
    }
    if (user.profilRevendeur) {
      return NextResponse.json({ error: "Ce revendeur a déjà un compte ouvert" }, { status: 422 });
    }

    const adminId = parseInt(session.user.id);
    const profil = await prisma.$transaction(async (tx) => {
      const p = await tx.profilRevendeur.create({
        data: {
          userId,
          raisonSociale: body.raisonSociale.trim(),
          nomCommercial: body.nomCommercial || null,
          nif: body.nif || null,
          rccm: body.rccm || null,
          adresse: body.adresse || null,
          ville: body.ville || null,
          contactNom: body.contactNom || null,
          contactTelephone: body.contactTelephone || null,
          contactEmail: body.contactEmail || null,
          pointDeVenteId: body.pointDeVenteId ? Number(body.pointDeVenteId) : null,
          conditionsParticulieres: body.conditionsParticulieres || null,
          ouvertParId: adminId,
        },
        include: INCLUDE,
      });
      await auditLog(tx, adminId, "REVENDEUR_COMPTE_OUVERT", "ProfilRevendeur", p.id, undefined, getRequestMeta(req));
      return p;
    });
    return NextResponse.json({ data: profil }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/revendeurs:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
