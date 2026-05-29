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
      // Enregistrement EN_ATTENTE — l'effet financier sur la souscription sera
      // appliqué par le caissier lors de la confirmation individuelle.
      const versement = await tx.versementPack.create({
        data: {
          souscriptionId,
          type: "VERSEMENT_PERIODIQUE",
          montant: montantNum,
          statut: "EN_ATTENTE",
          datePaiement: new Date(),
          encaisseParId: parseInt(session.user.id),
          encaisseParNom: agentNom,
          notes: notes || `Collecte terrain — ${agentNom}`,
          ...(echeanceId ? { reference: `ECH-${echeanceId}` } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: "COLLECTE_PACK_TERRAIN_EN_ATTENTE",
          entite: "VersementPack",
          entiteId: versement.id,
        },
      });

      await notifyAdmins(tx, {
        titre: `Collecte terrain à confirmer — ${souscription.pack.nom}`,
        message: `${agentNom} a collecté ${montantNum.toLocaleString("fr-FR")} FCFA chez ${clientNom} (souscription #${souscriptionId}). En attente de confirmation caissier.`,
        priorite: "NORMAL",
        actionUrl: "/dashboard/user/caissiers",
      });

      return versement;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/agentTerrain/packs/[id]/collecte", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
