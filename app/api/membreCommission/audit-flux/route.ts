import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";

async function estMembreAudit(userId: number) {
  const membre = await prisma.membreCommissionRIA.findFirst({
    where: { userId, typeCommission: "AUDIT", actif: true },
  });
  return !!membre;
}

// Flux automatique reçu par la Commission Audit & Contrôle :
// dossiers approuvés, financements réalisés, décaissements, recouvrements.
export async function GET() {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    if (auth.commission !== null && !(await estMembreAudit(userId))) {
      return NextResponse.json({ error: "Réservé aux membres de la commission Audit & Contrôle" }, { status: 403 });
    }

    const [dossiersApprouves, financements, decaissements, recouvrements] = await Promise.all([
      prisma.dossierInterCommission.findMany({
        where: { statut: { in: ["APPROUVE", "EXECUTE"] } },
        select: {
          id: true, reference: true, titre: true, statut: true,
          montantApprouve: true, commissionEmettrice: true, commissionReceptrice: true,
          dateValidation: true,
          _count: { select: { missionsAudit: true } },
        },
        orderBy: { dateValidation: "desc" },
        take: 30,
      }),
      prisma.operationFinancementRIA.findMany({
        select: {
          id: true, reference: true, montantFinance: true, statut: true, dateFinancement: true,
          client: { select: { nom: true, prenom: true } },
          _count: { select: { missionsAudit: true } },
        },
        orderBy: { dateFinancement: "desc" },
        take: 30,
      }),
      prisma.mouvementFondsRIA.findMany({
        where: { type: "FINANCEMENT_CLIENT" },
        select: {
          id: true, montant: true, description: true, reference: true, createdAt: true,
          financement: { select: { id: true, reference: true, client: { select: { nom: true, prenom: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.remboursementRIA.findMany({
        select: {
          id: true, montant: true, createdAt: true,
          financement: { select: { id: true, reference: true, client: { select: { nom: true, prenom: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    return NextResponse.json({ dossiersApprouves, financements, decaissements, recouvrements });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
