import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { notifyAdmins } from "@/lib/notifications";

/**
 * POST /api/agentTerrain/souscriptions
 * Crée une souscription EN_ATTENTE pour un client du PDV de l'agent.
 * L'admin devra valider (passer en ACTIF) après vérification.
 *
 * Body: { packId, clientId, montantTotal, acompteInitial?, frequenceVersement?, formuleRevendeur?, notes? }
 */
export async function POST(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    // Résoudre le PDV de l'agent
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    if (!aff?.pointDeVenteId) {
      return NextResponse.json({ error: "Aucun point de vente associé à cet agent" }, { status: 400 });
    }
    const pdvId = aff.pointDeVenteId;

    const body = await req.json();
    const { packId, clientId, montantTotal, acompteInitial, frequenceVersement, formuleRevendeur, notes } = body;

    if (!packId || !clientId || !montantTotal) {
      return NextResponse.json({ error: "packId, clientId et montantTotal sont obligatoires" }, { status: 400 });
    }

    const montantTotalNum = parseFloat(montantTotal);
    if (isNaN(montantTotalNum) || montantTotalNum <= 0) {
      return NextResponse.json({ error: "montantTotal doit être > 0" }, { status: 400 });
    }

    // Vérifier que le client appartient bien au PDV de l'agent
    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) },
      select: { id: true, nom: true, prenom: true, pointDeVenteId: true },
    });
    if (!client || client.pointDeVenteId !== pdvId) {
      return NextResponse.json({ error: "Client introuvable ou hors PDV" }, { status: 403 });
    }

    const pack = await prisma.pack.findUnique({ where: { id: parseInt(packId) } });
    if (!pack || !pack.actif) {
      return NextResponse.json({ error: "Pack introuvable ou inactif" }, { status: 404 });
    }

    const acompteNum = acompteInitial ? parseFloat(acompteInitial) : 0;
    const debut = new Date();
    const dateFinRes = pack.dureeJours
      ? new Date(debut.getTime() + Number(pack.dureeJours) * 24 * 60 * 60 * 1000)
      : null;

    const agentNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
    const montantRestant = montantTotalNum - acompteNum;

    const result = await prisma.$transaction(async (tx) => {
      const souscription = await tx.souscriptionPack.create({
        data: {
          packId: parseInt(packId),
          clientId: client.id,
          formuleRevendeur: formuleRevendeur ?? null,
          frequenceVersement: frequenceVersement ?? null,
          statut: "EN_ATTENTE",
          montantTotal: montantTotalNum,
          montantVerse: acompteNum,
          montantRestant,
          dateDebut: debut,
          dateFin: dateFinRes,
          notes,
          enregistrePar: agentNom,
        },
      });

      // Échéancier selon le type de pack
      if (pack.type === "ALIMENTAIRE") {
        const duree = pack.dureeJours ?? 30;
        const freq = pack.frequenceVersement;
        const step = freq === "QUOTIDIEN" ? 1 : freq === "HEBDOMADAIRE" ? 7 : freq === "BIMENSUEL" ? 14 : 30;
        const count = Math.ceil(duree / step);
        const montantEcheance = Math.round((montantTotalNum / count) * 100) / 100;
        await tx.echeancePack.createMany({
          data: Array.from({ length: count }, (_, i) => {
            const date = new Date(debut);
            date.setDate(date.getDate() + (i + 1) * step);
            return {
              souscriptionId: souscription.id, numero: i + 1,
              montant: i === count - 1
                ? Math.round((montantTotalNum - montantEcheance * (count - 1)) * 100) / 100
                : montantEcheance,
              datePrevue: date, statut: "EN_ATTENTE" as const,
            };
          }),
        });
      } else if (pack.type === "FAMILIAL") {
        const duree = pack.dureeJours ?? 30;
        const freq = frequenceVersement ?? pack.frequenceVersement ?? "HEBDOMADAIRE";
        const step = freq === "QUOTIDIEN" ? 1 : freq === "HEBDOMADAIRE" ? 7 : freq === "BIMENSUEL" ? 14 : 30;
        const count = Math.ceil(duree / step);
        const montantEcheance = Math.round((montantTotalNum / count) * 100) / 100;
        await tx.echeancePack.createMany({
          data: Array.from({ length: count }, (_, i) => {
            const date = new Date(debut);
            date.setDate(date.getDate() + (i + 1) * step);
            return {
              souscriptionId: souscription.id, numero: i + 1,
              montant: i === count - 1
                ? Math.round((montantTotalNum - montantEcheance * (count - 1)) * 100) / 100
                : montantEcheance,
              datePrevue: date, statut: "EN_ATTENTE" as const,
            };
          }),
        });
      } else if (pack.type === "URGENCE") {
        const duree = pack.dureeJours ?? 10;
        const montantEcheance = Math.round((montantRestant / duree) * 100) / 100;
        await tx.echeancePack.createMany({
          data: Array.from({ length: duree }, (_, i) => {
            const date = new Date(debut);
            date.setDate(date.getDate() + i + 1);
            return {
              souscriptionId: souscription.id, numero: i + 1,
              montant: i === duree - 1
                ? Math.round((montantRestant - montantEcheance * (duree - 1)) * 100) / 100
                : montantEcheance,
              datePrevue: date, statut: "EN_ATTENTE" as const,
            };
          }),
        });
      } else if (pack.type === "EPARGNE_PRODUIT" && pack.montantVersement && Number(pack.montantVersement) > 0) {
        const freq = pack.frequenceVersement ?? "MENSUEL";
        const step = freq === "QUOTIDIEN" ? 1 : freq === "HEBDOMADAIRE" ? 7 : freq === "BIMENSUEL" ? 14 : 30;
        const epargneParEcheance = Number(pack.montantVersement);
        const count = Math.ceil(montantTotalNum / epargneParEcheance);
        await tx.echeancePack.createMany({
          data: Array.from({ length: count }, (_, i) => {
            const date = new Date(debut);
            date.setDate(date.getDate() + (i + 1) * step);
            return {
              souscriptionId: souscription.id, numero: i + 1,
              montant: i === count - 1
                ? Math.round((montantTotalNum - epargneParEcheance * (count - 1)) * 100) / 100
                : epargneParEcheance,
              datePrevue: date, statut: "EN_ATTENTE" as const,
            };
          }),
        });
      } else if (pack.type === "REVENDEUR" && formuleRevendeur === "FORMULE_2") {
        const duree = pack.dureeJours ?? 16;
        const montantEcheance = Math.round((montantRestant / duree) * 100) / 100;
        await tx.echeancePack.createMany({
          data: Array.from({ length: duree }, (_, i) => {
            const date = new Date(debut);
            date.setDate(date.getDate() + i + 1);
            return {
              souscriptionId: souscription.id, numero: i + 1,
              montant: i === duree - 1
                ? Math.round((montantRestant - montantEcheance * (duree - 1)) * 100) / 100
                : montantEcheance,
              datePrevue: date, statut: "EN_ATTENTE" as const,
            };
          }),
        });
      } else if (pack.type === "REVENDEUR" && formuleRevendeur === "FORMULE_1") {
        const duree = pack.dureeJours ?? 56;
        const step = 7;
        const count = Math.ceil(duree / step);
        const montantEcheance = Math.round((montantRestant / count) * 100) / 100;
        await tx.echeancePack.createMany({
          data: Array.from({ length: count }, (_, i) => {
            const date = new Date(debut);
            date.setDate(date.getDate() + (i + 1) * step);
            return {
              souscriptionId: souscription.id, numero: i + 1,
              montant: i === count - 1
                ? Math.round((montantRestant - montantEcheance * (count - 1)) * 100) / 100
                : montantEcheance,
              datePrevue: date, statut: "EN_ATTENTE" as const,
            };
          }),
        });
      }

      if (acompteNum > 0) {
        await tx.versementPack.create({
          data: {
            souscriptionId: souscription.id,
            type: "COTISATION_INITIALE",
            montant: acompteNum,
            statut: "PAYE",
            datePaiement: new Date(),
            encaisseParId: parseInt(session.user.id),
            encaisseParNom: agentNom,
            notes: `Acompte initial — ${pack.nom}`,
          },
        });
      }

      await notifyAdmins(tx, {
        titre: `Nouvelle souscription (terrain) — ${pack.nom}`,
        message: `${agentNom} a enregistré une souscription au pack ${pack.nom} pour ${client.prenom} ${client.nom} (${montantTotalNum.toLocaleString("fr-FR")} FCFA). En attente de validation.`,
        priorite: "NORMAL",
        actionUrl: "/dashboard/admin/packs",
      });

      return souscription;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/agentTerrain/souscriptions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
