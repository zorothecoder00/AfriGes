import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — Enregistre un versement sur une souscription (côté admin).
 * Met à jour montantVerse, montantRestant et le statut de la souscription.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const souscriptionId = parseInt(id);
    const body = await req.json();
    const { montant, type, notes, echeanceId } = body;

    if (!montant || parseFloat(montant) <= 0) {
      return NextResponse.json({ error: "Montant obligatoire et > 0" }, { status: 400 });
    }

    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: souscriptionId },
      include: { pack: true },
    });

    if (!souscription) {
      return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    }
    if (souscription.statut === "ANNULE" || souscription.statut === "COMPLETE") {
      return NextResponse.json(
        { error: `Souscription déjà ${souscription.statut.toLowerCase()}` },
        { status: 400 }
      );
    }

    const montantNum = parseFloat(montant);
    const adminNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const result = await prisma.$transaction(async (tx) => {
      const nouveauMontantVerse = Number(souscription.montantVerse) + montantNum;
      const nouveauMontantRestant = Number(souscription.montantTotal) - nouveauMontantVerse;
      const estSolde = nouveauMontantRestant <= 0;

      const versement = await tx.versementPack.create({
        data: {
          souscriptionId,
          type: type ?? "VERSEMENT_PERIODIQUE",
          montant: montantNum,
          statut: "PAYE",
          datePaiement: new Date(),
          encaisseParId: parseInt(session.user.id),
          encaisseParNom: adminNom,
          notes,
        },
      });

      const updatedSouscription = await tx.souscriptionPack.update({
        where: { id: souscriptionId },
        data: {
          montantVerse: nouveauMontantVerse,
          montantRestant: estSolde ? 0 : nouveauMontantRestant,
          statut: estSolde ? "COMPLETE" : "ACTIF",
          dateCloture: estSolde ? new Date() : null,
        },
      });

      // Marquer l'échéance si fournie
      if (echeanceId) {
        await tx.echeancePack.update({
          where: { id: parseInt(echeanceId) },
          data: { statut: "PAYE", datePaiement: new Date() },
        });
      } else {
        const prochaine = await tx.echeancePack.findFirst({
          where: { souscriptionId, statut: "EN_ATTENTE" },
          orderBy: { numero: "asc" },
        });
        if (prochaine) {
          await tx.echeancePack.update({
            where: { id: prochaine.id },
            data: { statut: "PAYE", datePaiement: new Date() },
          });
        }
      }

      if (estSolde) {
        await notifyAdmins(tx, {
          titre: `Pack soldé — ${souscription.pack.nom}`,
          message: `La souscription #${souscriptionId} au pack ${souscription.pack.nom} est entièrement soldée (${Number(souscription.montantTotal).toLocaleString("fr-FR")} FCFA).`,
          priorite: "HAUTE",
          actionUrl: "/dashboard/admin/packs",
        });
      }

      return { versement, souscription: updatedSouscription };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/packs/souscriptions/[id]/versement", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
