import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";
import { notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — Enregistre un versement sur une souscription pack.
 * Met à jour automatiquement montantVerse, montantRestant et le statut
 * de la souscription (COMPLETE si soldée).
 * Si une échéance correspond à la date, elle est marquée PAYEE.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

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
    const caissierNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const result = await prisma.$transaction(async (tx) => {
      const nouveauMontantVerse = Number(souscription.montantVerse) + montantNum;
      const nouveauMontantRestant = Number(souscription.montantTotal) - nouveauMontantVerse;
      const estSolde = nouveauMontantRestant <= 0;

      // 1. Créer le versement
      const versement = await tx.versementPack.create({
        data: {
          souscriptionId,
          type: type ?? "VERSEMENT_PERIODIQUE",
          montant: montantNum,
          statut: "PAYE",
          datePaiement: new Date(),
          encaisseParId: parseInt(session.user.id),
          encaisseParNom: caissierNom,
          notes,
        },
      });

      // 2. Mettre à jour la souscription
      const updatedSouscription = await tx.souscriptionPack.update({
        where: { id: souscriptionId },
        data: {
          montantVerse: nouveauMontantVerse,
          montantRestant: estSolde ? 0 : nouveauMontantRestant,
          statut: estSolde ? "COMPLETE" : "ACTIF",
          dateCloture: estSolde ? new Date() : null,
        },
      });

      // 3. Marquer l'échéance comme payée si fournie
      if (echeanceId) {
        await tx.echeancePack.update({
          where: { id: parseInt(echeanceId) },
          data: { statut: "PAYE", datePaiement: new Date() },
        });
      } else {
        // Chercher la première échéance EN_ATTENTE et la marquer PAYE
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

      // 4. Notifier admin si souscription soldée
      if (estSolde) {
        await notifyAdmins(tx, {
          titre: `Pack soldé — ${souscription.pack.nom}`,
          message: `La souscription #${souscriptionId} au pack ${souscription.pack.nom} est entièrement soldée (${Number(souscription.montantTotal).toLocaleString("fr-FR")} FCFA).`,
          priorite: "HAUTE",
          actionUrl: "/dashboard/user/packs",
        });
      }

      return { versement, souscription: updatedSouscription };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/caissier/packs/[id]/versement", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
