import { NextResponse } from "next/server";
import { PrioriteNotification, StatutBonSortie, TypeSortieStock } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { getVisaRpvOuChefAgenceSession } from "@/lib/authRPV";
import { requirePermission } from "@/lib/permissions";
import { auditLog, notify, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { comptabiliserBonSortie } from "@/lib/comptabilite/ecrituresBonSortie";
import { getSeuilVisaBonSortie } from "@/lib/parametresDocuments";
import { nouveauJetonConfirmation, livraisonConfirmationUrl } from "@/lib/livraisonConfirmation";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/magasinier/bons-sortie/[id]
 * Détail d'un bon de sortie
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const { id } = await params;
    const bonId = Number(id);
    if (isNaN(bonId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const bon = await prisma.bonSortie.findUnique({
      where: { id: bonId },
      include: {
        lignes: {
          include: { produit: { select: { id: true, nom: true, prixUnitaire: true } } },
        },
        creePar:  { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
        visePar:   { select: { id: true, nom: true, prenom: true } },
        bonPreparation: { include: { lignes: { include: { produit: { select: { id: true, nom: true } } } }, preparateur: { select: { id: true, nom: true, prenom: true } } } },
        bonLivraison: { select: { id: true, reference: true, clientNom: true } },
        commandeClient: { select: { id: true, reference: true, client: { select: { nom: true, prenom: true, telephone: true } } } },
      },
    });

    if (!bon) return NextResponse.json({ error: "Bon introuvable" }, { status: 404 });

    const seuilVisaBonSortie = await getSeuilVisaBonSortie();
    return NextResponse.json({ data: bon, seuilVisaBonSortie });
  } catch (error) {
    console.error("GET /magasinier/bons-sortie/[id]:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/**
 * PATCH /api/magasinier/bons-sortie/[id]
 * Mettre à jour le statut d'un bon de sortie
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const bonId = Number(id);
    if (isNaN(bonId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();

    // Visa (Responsable Point de Vente / Chef d'agence / Direction) — CDC §3.4 :
    // action distincte du magasinier, requise pour exécuter les sorties dont la
    // valorisation dépasse le seuil paramétré.
    if (body.action === "VISER") {
      const viseur = await getVisaRpvOuChefAgenceSession();
      if (!viseur) {
        return NextResponse.json({ error: "Visa réservé au Responsable Point de Vente / Chef d'agence / Direction" }, { status: 403 });
      }
      const bonAViser = await prisma.bonSortie.findUnique({
        where: { id: bonId },
        include: { pointDeVente: { select: { rpvId: true, chefAgenceId: true } } },
      });
      if (!bonAViser) return NextResponse.json({ error: "Bon introuvable" }, { status: 404 });
      // Périmètre : le RPV vise les bons de son agence, le chef d'agence ceux des agences
      // qu'il supervise ; la Direction (admin) vise partout.
      const estAdminViseur = viseur.user.role === "ADMIN" || viseur.user.role === "SUPER_ADMIN";
      const viseurUserId = parseInt(viseur.user.id);
      if (!estAdminViseur && bonAViser.pointDeVente.rpvId !== viseurUserId && bonAViser.pointDeVente.chefAgenceId !== viseurUserId) {
        return NextResponse.json({ error: "Ce bon de sortie n'appartient pas à une agence que vous supervisez" }, { status: 403 });
      }
      if (bonAViser.statut !== "BROUILLON") {
        return NextResponse.json({ error: "Seul un bon en attente peut être visé" }, { status: 422 });
      }
      const seuilViser = await getSeuilVisaBonSortie();
      if (!(Number(bonAViser.montantTotal ?? 0) > seuilViser)) {
        return NextResponse.json({ error: "Ce bon ne dépasse pas le seuil de visa" }, { status: 422 });
      }
      const viseurId = parseInt(viseur.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const b = await tx.bonSortie.update({
          where: { id: bonId },
          data: { viseParId: viseurId, dateVisa: new Date() },
          include: {
            lignes: { include: { produit: { select: { id: true, nom: true } } } },
            creePar: { select: { nom: true, prenom: true } },
            visePar: { select: { id: true, nom: true, prenom: true } },
          },
        });
        await auditLog(tx, viseurId, "BON_SORTIE_VISE", "BonSortie", bonId);
        return b;
      });
      return NextResponse.json({ data: updated });
    }

    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const { statut, notes } = body;

    const validStatuts: StatutBonSortie[] = ["BROUILLON", "VALIDE", "ANNULE"];
    if (!statut || !validStatuts.includes(statut)) {
      return NextResponse.json({ error: "Statut invalide (BROUILLON|VALIDE|ANNULE)" }, { status: 400 });
    }
    // L'annulation d'un bon = suppression logique (RBAC granulaire).
    if (statut === "ANNULE") {
      const denied = await requirePermission(session, "stock", "SUPPRESSION_LOGIQUE");
      if (denied) return denied;
    }

    const bon = await prisma.bonSortie.findUnique({
      where: { id: bonId },
      include: {
        lignes:      true,
        pointDeVente:{ select: { nom: true } },
        bonPreparation: { select: { statut: true } },
      },
    });
    if (!bon) return NextResponse.json({ error: "Bon introuvable" }, { status: 404 });

    // Ajustement des quantités par le magasinier au moment de l'exécution (ex. bon rempli
    // par un agent terrain) : uniquement à la baisse par rapport à la demande — une hausse
    // contournerait le visa déjà donné, elle passe par un nouveau bon. Un écart impose un
    // commentaire (CDC §3.4). Appliqué en mémoire ici, persisté dans la transaction d'exécution.
    let ajustementQuantites: { commentaireEcart: string | null; montantTotal: number } | null = null;
    if (Array.isArray(body.lignes) && statut === "VALIDE" && bon.statut === "BROUILLON") {
      if (bon.typeSortie === "LIVRAISON_CLIENT") {
        return NextResponse.json({ error: "Les quantités d'une livraison client se corrigent dans le bon de préparation" }, { status: 400 });
      }
      const saisies = new Map<number, number>(
        (body.lignes as { id: unknown; quantite: unknown }[]).map((l) => [Number(l.id), Number(l.quantite)])
      );
      for (const l of bon.lignes) {
        if (!saisies.has(l.id)) continue;
        const q = saisies.get(l.id)!;
        const max = l.quantiteDemandee ?? l.quantite;
        if (!Number.isInteger(q) || q < 0 || q > max) {
          return NextResponse.json({ error: `Quantité invalide pour une ligne : entre 0 et ${max} (quantité demandée)` }, { status: 400 });
        }
        if (l.quantiteDemandee == null) l.quantiteDemandee = l.quantite;
        l.quantite = q;
      }
      if (bon.lignes.every((l) => l.quantite === 0)) {
        return NextResponse.json({ error: "Aucune quantité à sortir : annulez plutôt le bon" }, { status: 400 });
      }
      const aUnEcart = bon.lignes.some((l) => l.quantite < (l.quantiteDemandee ?? l.quantite));
      const commentaire = String(body.commentaireEcart ?? "").trim();
      if (aUnEcart && !commentaire) {
        return NextResponse.json({ error: "Une quantité sortie est inférieure à la demande : le commentaire d'écart est obligatoire" }, { status: 400 });
      }
      ajustementQuantites = {
        commentaireEcart: aUnEcart ? commentaire : null,
        montantTotal: bon.lignes.reduce((s, l) => s + l.quantite * Number(l.prixUnit ?? 0), 0),
      };
    }

    // Visa requis avant toute exécution si la valorisation dépasse le seuil paramétré.
    if (statut === "VALIDE" && bon.statut === "BROUILLON") {
      const seuilValide = await getSeuilVisaBonSortie();
      const valorisation = ajustementQuantites?.montantTotal ?? Number(bon.montantTotal ?? 0);
      if (valorisation > seuilValide && !bon.viseParId) {
        return NextResponse.json(
          { error: `Visa requis avant exécution (valorisation > ${seuilValide.toLocaleString("fr-FR")} FCFA)` },
          { status: 422 }
        );
      }
    }

    // Bon de Préparation (CDC digitalisation §5.7) — la préparation doit être
    // clôturée par le magasinier avant de pouvoir confirmer l'expédition.
    if (statut === "VALIDE" && bon.statut === "BROUILLON" && bon.bonPreparation && bon.bonPreparation.statut !== "PRETE") {
      return NextResponse.json(
        { error: "La préparation de la commande doit être marquée « prête » avant de confirmer l'expédition" },
        { status: 422 }
      );
    }

    // Cas spécial : LIVRAISON_CLIENT BROUILLON → VALIDE (confirmer expédition + décrémenter stock)
    if (statut === "VALIDE" && bon.statut === "BROUILLON" && bon.typeSortie === "LIVRAISON_CLIENT") {
      // Vérifier les stocks avant transaction
      for (const l of bon.lignes) {
        const stock = await prisma.stockSite.findUnique({
          where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: bon.pointDeVenteId } },
          include: { produit: { select: { nom: true } } },
        });
        if (!stock || stock.quantite < l.quantite) {
          return NextResponse.json(
            { error: `Stock insuffisant pour "${stock?.produit.nom ?? l.produitId}". Dispo : ${stock?.quantite ?? 0}, demandé : ${l.quantite}` },
            { status: 400 }
          );
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        for (const l of bon.lignes) {
          await tx.stockSite.update({
            where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: bon.pointDeVenteId } },
            data: { quantite: { decrement: l.quantite } },
          });
          await tx.mouvementStock.create({
            data: {
              produitId:      l.produitId,
              pointDeVenteId: bon.pointDeVenteId,
              type:           "SORTIE",
              typeSortie:     "LIVRAISON_CLIENT",
              quantite:       l.quantite,
              motif:          `Livraison client confirmée — ${bon.reference}`,
              reference:      `${bon.reference}-P${l.produitId}`,
              operateurId:    parseInt(session.user.id),
              bonSortieId:    bon.id,
            },
          });
        }

        const result = await tx.bonSortie.update({
          where: { id: bonId },
          data: {
            statut:      "VALIDE",
            valideParId: parseInt(session.user.id),
            dateValidation: new Date(),
            notes:       notes ?? bon.notes,
          },
          include: {
            lignes:  { include: { produit: { select: { id: true, nom: true } } } },
            creePar: { select: { nom: true, prenom: true } },
          },
        });

        await auditLog(tx, parseInt(session.user.id), "BON_SORTIE_VALIDE", "BonSortie", bon.id);
        await comptabiliserBonSortie(tx, bon.id, parseInt(session.user.id));

        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "RESPONSABLE_POINT_DE_VENTE", "COMPTABLE"], {
          titre:    `Livraison client expédiée (${bon.reference})`,
          message:  `${session.user.prenom} ${session.user.nom} a confirmé l'expédition de la livraison client "${bon.reference}" depuis "${bon.pointDeVente.nom}". ${bon.lignes.length} produit(s) déduit(s) du stock.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl:`/dashboard/magasinier/bons-sortie/${bon.id}`,
        });

        // Cascade Bon de Commande Client (CDC digitalisation §3.2) — l'expédition
        // de la livraison client marque la commande d'origine comme "Livrée".
        const commandeClient = await tx.commandeClient.findUnique({
          where: { bonSortieId: bon.id },
          select: { id: true, reference: true, agentId: true, lieuLivraison: true, client: { select: { nom: true, prenom: true, telephone: true, adresse: true } } },
        });
        if (commandeClient) {
          await tx.commandeClient.update({ where: { id: commandeClient.id }, data: { statut: "LIVREE" } });
          await notify(tx, [commandeClient.agentId], {
            titre: `Commande ${commandeClient.reference} livrée`,
            message: `La livraison a été expédiée par ${session.user.prenom} ${session.user.nom}.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/agentsTerrain/commandes-client?detail=${commandeClient.id}`,
          });

          // Génération automatique du Bon de Livraison (CDC digitalisation §5.7) —
          // document de transport accompagnant physiquement la marchandise, distinct
          // du Bon de Réception (attestation du client à l'arrivée, généré juste après).
          const referenceBL = `BL-${Date.now()}-${commandeClient.id}`;
          const bonLivraison = await tx.bonLivraison.create({
            data: {
              reference: referenceBL,
              bonSortieId: bon.id,
              commandeClientId: commandeClient.id,
              clientNom: `${commandeClient.client.prenom} ${commandeClient.client.nom}`,
              clientTelephone: commandeClient.client.telephone,
              adresseLivraison: commandeClient.lieuLivraison || commandeClient.client.adresse,
              livreurId: parseInt(session.user.id),
              moyenTransport: typeof body.moyenTransport === "string" ? body.moyenTransport.trim() || null : null,
              lignes: { create: bon.lignes.map((l) => ({ produitId: l.produitId, quantite: l.quantite })) },
            },
          });
          await auditLog(tx, parseInt(session.user.id), "BL_GENERE", "BonLivraison", bonLivraison.id, undefined, getRequestMeta(req));

          // Génération automatique du Bon de Réception (CDC digitalisation §3.5) —
          // lien de confirmation sans compte, à transmettre au client par le livreur.
          const referenceBR = `BR-${Date.now()}-${commandeClient.id}`;
          const token = nouveauJetonConfirmation();
          const bonReception = await tx.bonReception.create({
            data: {
              reference: referenceBR,
              bonSortieId: bon.id,
              commandeClientId: commandeClient.id,
              clientNom: `${commandeClient.client.prenom} ${commandeClient.client.nom}`,
              clientTelephone: commandeClient.client.telephone,
              clientAdresse: commandeClient.client.adresse,
              tokenConfirmation: token,
              dateEnvoiLien: new Date(),
              livreurId: parseInt(session.user.id),
              lignes: { create: bon.lignes.map((l) => ({ produitId: l.produitId, quantiteCommandee: l.quantite, quantiteLivree: l.quantite })) },
            },
          });
          await auditLog(tx, parseInt(session.user.id), "BR_GENERE", "BonReception", bonReception.id, undefined, undefined);
          await notify(tx, [parseInt(session.user.id)], {
            titre: `Lien de confirmation de livraison généré (${referenceBR})`,
            message: `Bon de livraison ${referenceBL} généré. Transmettez ce lien au client pour qu'il atteste la réception : ${livraisonConfirmationUrl(req, token)}`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/magasiniers?tab=livraisons`,
          });
        }

        return result;
      });

      return NextResponse.json({ data: updated });
    }

    // Cas PERTE/CASSE/VOL/DON/CONSOMMATION_INTERNE/RETOUR_FOURNISSEUR BROUILLON
    // → VALIDE : décrémenter le stock disponible (4.1). PERTE/CASSE vont en plus
    // vers l'endommagé (4.4) — les autres types quittent le stock définitivement
    // sans y être "abîmés". Avant cet élargissement, seuls PERTE/CASSE
    // décrémentaient réellement le stock : un bon DON/VOL/CONSOMMATION_INTERNE/
    // RETOUR_FOURNISSEUR validé ne faisait rien de réel (CDC §56).
    const TYPES_SORTIE_STOCK_REEL: TypeSortieStock[] = ["PERTE", "CASSE", "VOL", "DON", "CONSOMMATION_INTERNE", "RETOUR_FOURNISSEUR"];
    if (statut === "VALIDE" && bon.statut === "BROUILLON" && TYPES_SORTIE_STOCK_REEL.includes(bon.typeSortie)) {
      const versEndommage = bon.typeSortie === "PERTE" || bon.typeSortie === "CASSE";
      // Vérifier les stocks avant transaction
      for (const l of bon.lignes) {
        if (l.quantite === 0) continue;
        const stock = await prisma.stockSite.findUnique({
          where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: bon.pointDeVenteId } },
          include: { produit: { select: { nom: true } } },
        });
        if (!stock || stock.quantite < l.quantite) {
          return NextResponse.json(
            { error: `Stock insuffisant pour "${stock?.produit.nom ?? l.produitId}". Dispo : ${stock?.quantite ?? 0}, demandé : ${l.quantite}` },
            { status: 400 }
          );
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (ajustementQuantites) {
          for (const l of bon.lignes) {
            await tx.ligneBonSortie.update({ where: { id: l.id }, data: { quantite: l.quantite, quantiteDemandee: l.quantiteDemandee } });
          }
          await tx.bonSortie.update({
            where: { id: bonId },
            data: { montantTotal: ajustementQuantites.montantTotal, commentaireEcart: ajustementQuantites.commentaireEcart },
          });
        }
        for (const l of bon.lignes) {
          if (l.quantite === 0) continue;
          // Décrémenter le disponible (4.1) — PERTE/CASSE en plus vers l'endommagé (4.4)
          await tx.stockSite.update({
            where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: bon.pointDeVenteId } },
            data: versEndommage
              ? { quantite: { decrement: l.quantite }, quantiteEndommagee: { increment: l.quantite } }
              : { quantite: { decrement: l.quantite } },
          });
          await tx.mouvementStock.create({
            data: {
              produitId:      l.produitId,
              pointDeVenteId: bon.pointDeVenteId,
              type:           "SORTIE",
              typeSortie:     bon.typeSortie,
              quantite:       l.quantite,
              motif:          `${bon.typeSortie} constatée — ${bon.reference}`,
              reference:      `${bon.reference}-P${l.produitId}`,
              operateurId:    parseInt(session.user.id),
              bonSortieId:    bon.id,
            },
          });
        }

        const result = await tx.bonSortie.update({
          where: { id: bonId },
          data: { statut: "VALIDE", valideParId: parseInt(session.user.id), dateValidation: new Date(), notes: notes ?? bon.notes },
          include: { lignes: { include: { produit: { select: { id: true, nom: true } } } }, creePar: { select: { nom: true, prenom: true } } },
        });

        await auditLog(tx, parseInt(session.user.id), "BON_SORTIE_VALIDE", "BonSortie", bon.id);
        await comptabiliserBonSortie(tx, bon.id, parseInt(session.user.id));

        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "RESPONSABLE_POINT_DE_VENTE"], {
          titre:    `${bon.typeSortie} enregistrée (${bon.reference})`,
          message:  `${session.user.prenom} ${session.user.nom} a validé un bon de ${bon.typeSortie.toLowerCase()} (${bon.reference}) sur "${bon.pointDeVente.nom}". ${bon.lignes.length} produit(s) ${versEndommage ? "mis en stock endommagé" : "sortis du stock"}.`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl:`/dashboard/magasinier/bons-sortie/${bon.id}`,
        });

        return result;
      });

      return NextResponse.json({ data: updated });
    }

    // Mise à jour standard
    const updated = await prisma.bonSortie.update({
      where: { id: bonId },
      data: {
        statut,
        notes:       notes ?? bon.notes,
        valideParId: statut === "VALIDE" ? parseInt(session.user.id) : bon.valideParId,
      },
      include: {
        lignes:  { include: { produit: { select: { id: true, nom: true } } } },
        creePar: { select: { nom: true, prenom: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /magasinier/bons-sortie/[id]:", error);
    return NextResponse.json({ error: "Erreur lors de la mise a jour" }, { status: 500 });
  }
}
