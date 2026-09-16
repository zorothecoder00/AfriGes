import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { genererReferenceUnique } from "@/lib/depotVente";
import { getSession } from "../../fournisseurs/route";

/**
 * Convention de dépôt-vente (CDC digitalisation §5.5) — contrat cadre avec un
 * fournisseur déposant. Namespace logistique/appro, comme Fournisseur/RFQ/
 * BonCommande/DemandeAchatInterne.
 */

export const INCLUDE = {
  fournisseur: { select: { id: true, nom: true, code: true, telephone: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
  depots: { select: { id: true, reference: true, statut: true } },
  reglements: { select: { id: true, reference: true, statut: true, montantDu: true } },
};

/**
 * GET /api/logistique/depot-vente/conventions
 * Query: statut?, fournisseurId?
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const fournisseurId = searchParams.get("fournisseurId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (fournisseurId) where.fournisseurId = Number(fournisseurId);

    const conventions = await prisma.conventionDepotVente.findMany({ where, orderBy: { createdAt: "desc" }, include: INCLUDE });
    return NextResponse.json({ data: conventions });
  } catch (error) {
    console.error("GET /logistique/depot-vente/conventions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/depot-vente/conventions
 * Body: { fournisseurId, commissionPourcent, dateFin?, dureeMaxInvenduJours?, conditions? }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const fournisseurId = Number(body.fournisseurId);
    if (!fournisseurId) return NextResponse.json({ error: "Fournisseur obligatoire" }, { status: 400 });

    const commissionPourcent = Number(body.commissionPourcent);
    if (!(commissionPourcent >= 0 && commissionPourcent <= 100)) {
      return NextResponse.json({ error: "Commission (%) invalide" }, { status: 400 });
    }

    const fournisseur = await prisma.fournisseur.findUnique({ where: { id: fournisseurId }, select: { id: true } });
    if (!fournisseur) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });

    const userId = parseInt(session.user.id);

    const convention = await genererReferenceUnique(
      "CDV",
      () => prisma.conventionDepotVente.count(),
      (reference) => prisma.$transaction(async (tx) => {
        const c = await tx.conventionDepotVente.create({
          data: {
            reference,
            fournisseurId,
            commissionPourcent,
            dateFin: body.dateFin ? new Date(body.dateFin) : null,
            dureeMaxInvenduJours: body.dureeMaxInvenduJours ? Number(body.dureeMaxInvenduJours) : null,
            conditions: body.conditions || null,
            creeParId: userId,
          },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "CDV_CREEE", "ConventionDepotVente", c.id, undefined, getRequestMeta(req));
        return c;
      }),
    );
    return NextResponse.json({ data: convention }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/depot-vente/conventions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
