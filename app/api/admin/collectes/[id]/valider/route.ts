import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { notifyRoles } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/collectes/[id]/valider
 * Valide une collecte EN_COURS :
 * - Pour chaque ligne COLLECTE ou PARTIEL → crée un VersementPack et met à jour la SouscriptionPack
 * - Met la collecte en statut VALIDEE
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const collecteId = Number(id);

    const collecte = await prisma.collecteJournaliere.findUnique({
      where: { id: collecteId },
      include: {
        lignes: {
          include: {
            souscription: { include: { pack: true } },
          },
        },
        agent: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!collecte) {
      return NextResponse.json({ message: "Collecte introuvable" }, { status: 404 });
    }
    if (collecte.statut !== "EN_COURS") {
      return NextResponse.json(
        { message: `Collecte déjà ${collecte.statut.toLowerCase()}` },
        { status: 400 }
      );
    }

    const adminNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
    const agentNom = `${collecte.agent.prenom} ${collecte.agent.nom}`;

    const lignesAValider = collecte.lignes.filter(
      (l) => l.statut === "COLLECTE" || l.statut === "PARTIEL"
    );

    if (lignesAValider.length === 0) {
      return NextResponse.json(
        { message: "Aucune ligne collectée à valider (statut COLLECTE ou PARTIEL requis)" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const ligne of lignesAValider) {
        const montant     = Number(ligne.montantCollecte);
        const souscription = ligne.souscription;

        const montantVerse  = Number(souscription.montantVerse)  + montant;
        const montantRestant = Math.max(0, Number(souscription.montantTotal) - montantVerse);
        const estSolde      = montantRestant <= 0;

        // Calcul statut souscription
        let nouveauStatut: string;
        if (estSolde) {
          nouveauStatut = "COMPLETE";
        } else if (
          souscription.pack.type === "REVENDEUR" &&
          souscription.formuleRevendeur === "FORMULE_1"
        ) {
          const seuil50 = Number(souscription.montantTotal) * 0.5;
          nouveauStatut = montantVerse >= seuil50 ? "ACTIF" : "EN_ATTENTE";
        } else if (souscription.pack.type === "URGENCE" && souscription.pack.acomptePercent) {
          const seuilAcompte =
            (Number(souscription.montantTotal) * Number(souscription.pack.acomptePercent)) / 100;
          nouveauStatut = montantVerse >= seuilAcompte ? "ACTIF" : "EN_ATTENTE";
        } else {
          nouveauStatut = "ACTIF";
        }

        // Créer le VersementPack
        const versement = await tx.versementPack.create({
          data: {
            souscriptionId: souscription.id,
            type:           "VERSEMENT_PERIODIQUE",
            montant,
            statut:         "PAYE",
            datePaiement:   new Date(),
            encaisseParId:  Number(session.user.id),
            encaisseParNom: adminNom,
            notes:          `Collecte ${collecte.reference} — agent ${agentNom}`,
            reference:      `VRS-COL-${collecte.reference}-L${ligne.id}`,
          },
        });

        // Lier versement à la ligne
        await tx.ligneCollecte.update({
          where: { id: ligne.id },
          data:  { versementPackId: versement.id },
        });

        // Mettre à jour la souscription
        await tx.souscriptionPack.update({
          where: { id: souscription.id },
          data:  {
            montantVerse:  montantVerse,
            montantRestant,
            statut:        nouveauStatut as never,
            dateCloture:   estSolde ? new Date() : null,
          },
        });

        // Marquer les échéances couvertes
        const nonPayees = await tx.echeancePack.findMany({
          where:   { souscriptionId: souscription.id, statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
          orderBy: { numero: "asc" },
        });

        if (estSolde) {
          await tx.echeancePack.updateMany({
            where: { souscriptionId: souscription.id, statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
            data:  { statut: "PAYE", datePaiement: new Date() },
          });
        } else {
          const idsAPayer: number[] = [];
          let budget = montant;
          for (const ec of nonPayees) {
            if (budget >= Number(ec.montant) - 0.01) {
              idsAPayer.push(ec.id);
              budget -= Number(ec.montant);
            } else break;
          }
          if (idsAPayer.length === 0 && nonPayees.length > 0) {
            idsAPayer.push(nonPayees[0].id);
          }
          if (idsAPayer.length > 0) {
            await tx.echeancePack.updateMany({
              where: { id: { in: idsAPayer } },
              data:  { statut: "PAYE", datePaiement: new Date() },
            });
          }
        }
      }

      // Recalculer le montant total collecté
      const totalCollecte = lignesAValider.reduce(
        (sum, l) => sum + Number(l.montantCollecte),
        0
      );

      // Valider la collecte
      await tx.collecteJournaliere.update({
        where: { id: collecteId },
        data:  {
          statut:         "VALIDEE",
          valideParId:    Number(session.user.id),
          dateValidation: new Date(),
          montantCollecte: totalCollecte,
        },
      });

      // Notifier l'agent terrain + RPV
      await notifyRoles(tx, ["AGENT_TERRAIN", "RESPONSABLE_POINT_DE_VENTE"], {
        titre:     `Collecte validée — ${collecte.reference}`,
        message:   `La collecte du ${new Date(collecte.dateCollecte).toLocaleDateString("fr-FR")} (${totalCollecte.toLocaleString("fr-FR")} FCFA) a été validée par ${adminNom}.`,
        priorite:  "NORMAL",
        actionUrl: `/dashboard/admin/collectes`,
      });
    });

    return NextResponse.json({ message: "Collecte validée avec succès" });
  } catch (error) {
    console.error("POST /api/admin/collectes/[id]/valider", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
