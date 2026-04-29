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

    if (souscription.statut === "ANNULE" || souscription.statut === "COMPLETE" ) {
      return NextResponse.json(
        {    
          error: `Souscription déjà ${souscription.statut.toLowerCase()}`,
          needsAdminIntervention: true,
          adminActions: [
            "Changer le statut de la souscription (ex: ACTIF)",
            "Déclencher une alerte via POST /api/admin/packs/souscriptions/{id}/alerte-urgence",
          ],
        },
        { status: 400 }
      );
    }

    const montantNum = parseFloat(montant);
    const montantRestantActuel = Number(souscription.montantRestant);

    if (montantNum > montantRestantActuel) {
      return NextResponse.json(
        {
          error: `Montant trop élevé : le restant dû est de ${montantRestantActuel.toLocaleString("fr-FR")} FCFA`,
        },
        { status: 400 }
      );
    }

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

      // 3. Marquer les échéances comme payées
      if (echeanceId) {
        // Échéance explicitement désignée
        await tx.echeancePack.update({
          where: { id: parseInt(echeanceId) },
          data: { statut: "PAYE", datePaiement: new Date() },
        });
      } else if (estSolde) {
        // Souscription entièrement soldée → toutes les échéances restantes sont soldées
        await tx.echeancePack.updateMany({
          where: { souscriptionId, statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
          data: { statut: "PAYE", datePaiement: new Date() },
        });
      } else {
        // Paiement partiel → marquer toutes les échéances couvertes par le montant versé
        const nonPayees = await tx.echeancePack.findMany({
          where: { souscriptionId, statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
          orderBy: { numero: "asc" },
        });
        const idsAPayer: number[] = [];
        let budget = montantNum;
        for (const ec of nonPayees) {
          if (budget >= Number(ec.montant) - 0.01) { // tolérance arrondi
            idsAPayer.push(ec.id);
            budget -= Number(ec.montant);
          } else {
            break;
          }
        }
        if (idsAPayer.length === 0 && nonPayees.length > 0) {
          idsAPayer.push(nonPayees[0].id);
        }
        if (idsAPayer.length > 0) {
          await tx.echeancePack.updateMany({
            where: { id: { in: idsAPayer } },
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
