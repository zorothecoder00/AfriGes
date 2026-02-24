import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/agentTerrain/packs/[id]/collecte
 * Enregistre un versement de terrain sur une souscription pack.
 * Body: { montant, notes?, echeanceId? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const souscriptionId = parseInt(id);
    const body = await req.json();
    const { montant, notes, echeanceId } = body;

    if (!montant || parseFloat(montant) <= 0) {
      return NextResponse.json({ error: "Montant obligatoire et > 0" }, { status: 400 });
    }

    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: souscriptionId },
      include: { pack: true, client: { select: { nom: true, prenom: true } } },
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
    const agentNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
    const clientNom = souscription.client
      ? `${souscription.client.prenom} ${souscription.client.nom}`
      : "Membre";

    const result = await prisma.$transaction(async (tx) => {
      const nouveauMontantVerse = Number(souscription.montantVerse) + montantNum;
      const nouveauMontantRestant = Number(souscription.montantTotal) - nouveauMontantVerse;
      const estSolde = nouveauMontantRestant <= 0;

      // 1. Créer le versement
      const versement = await tx.versementPack.create({
        data: {
          souscriptionId,
          type: "VERSEMENT_PERIODIQUE",
          montant: montantNum,
          statut: "PAYE",
          datePaiement: new Date(),
          encaisseParId: parseInt(session.user.id),
          encaisseParNom: agentNom,
          notes: notes || `Collecte terrain — ${agentNom}`,
        },
      });

      // 2. Mettre à jour la souscription
      const nouveauCycle =
        estSolde && souscription.pack.type === "FAMILIAL"
          ? souscription.numeroCycle + 1
          : souscription.numeroCycle;

      await tx.souscriptionPack.update({
        where: { id: souscriptionId },
        data: {
          montantVerse: nouveauMontantVerse,
          montantRestant: estSolde ? 0 : nouveauMontantRestant,
          statut: estSolde ? "COMPLETE" : "ACTIF",
          dateCloture: estSolde ? new Date() : null,
          numeroCycle: nouveauCycle,
        },
      });

      // 3. Marquer l'échéance comme payée
      if (echeanceId) {
        await tx.echeancePack.update({
          where: { id: parseInt(echeanceId) },
          data: { statut: "PAYE", datePaiement: new Date() },
        });
      } else {
        const prochaine = await tx.echeancePack.findFirst({
          where: { souscriptionId, statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
          orderBy: { numero: "asc" },
        });
        if (prochaine) {
          await tx.echeancePack.update({
            where: { id: prochaine.id },
            data: { statut: "PAYE", datePaiement: new Date() },
          });
        }
      }

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: "COLLECTE_PACK_TERRAIN",
          entite: "SouscriptionPack",
          entiteId: souscriptionId,
        },
      });

      // 5. Notifier les admins
      await notifyAdmins(tx, {
        titre: `Collecte terrain — ${souscription.pack.nom}`,
        message: `${agentNom} a collecté ${montantNum.toLocaleString("fr-FR")} FCFA chez ${clientNom} (souscription #${souscriptionId} — ${souscription.pack.nom}).${estSolde ? " Souscription soldée !" : ""}`,
        priorite: estSolde ? "HAUTE" : "NORMAL",
        actionUrl: "/dashboard/admin/packs",
      });

      return versement;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/agentTerrain/packs/[id]/collecte", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
