import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { montantJournalierArrondi } from "@/lib/echeancierCredit";
import { MemberStatus, NiveauRisque, Prisma, StatutCredit, PrioriteNotification, Role } from "@prisma/client";
import { notifyRoles, notifyAdmins, auditLog } from "@/lib/notifications";
import { getFidelite } from "@/lib/fidelite";
import { tariferLigne } from "@/lib/venteTarification";
import { estFormuleValide, dureeJoursPourFormule } from "@/lib/formuleCredit";
import { randomUUID } from "crypto";

/**
 * GET /api/rvc/credits
 * Liste paginée des crédits du PDV du RVC (filtres : statut, search)
 */
export async function GET(req: Request) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });
      rvcPdvId = aff.pointDeVenteId;
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.max(1, Number(searchParams.get("limit") || 20));
    const skip   = (page - 1) * limit;
    const search = (searchParams.get("search") || "").trim();
    const statut = searchParams.get("statut") as StatutCredit | null;

    const where: Prisma.CreditClientWhereInput = {
      ...(rvcPdvId !== null && { pointDeVenteId: rvcPdvId }),
      ...(statut && { statut }),
      ...(search && {
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { client: { nom:       { contains: search, mode: "insensitive" } } },
          { client: { prenom:    { contains: search, mode: "insensitive" } } },
          { client: { telephone: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [credits, total, creditsPourMois] = await Promise.all([
      prisma.creditClient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, reference: true, statut: true,
          montantTotal: true, montantRembourse: true, soldeRestant: true,
          dureeJours: true, dateDebut: true, dateEcheanceFin: true,
          montantJournalier: true, createdAt: true,
          tauxPenalite: true, delaiGraceJours: true,
          fraisDossier: true, assurance: true, autresFrais: true, fraisLivraison: true, tauxInteret: true,
          garantie: true, garantNom: true, garantTelephone: true, garantAdresse: true, garantTypeGarantie: true, garantValeurEstimee: true,
          client:   { select: { id: true, nom: true, prenom: true, codeClient: true, telephone: true } },
          creePar:  { select: { id: true, nom: true, prenom: true } },
          _count:   { select: { lignes: true, remboursements: true } },
        },
      }),
      prisma.creditClient.count({ where }),
      // Agrégat mensuel sur TOUS les crédits du filtre courant (hors pagination) :
      // les sous-totaux par mois doivent refléter tout le mois, pas seulement la page.
      prisma.creditClient.findMany({
        where,
        select: { dateDebut: true, montantTotal: true },
      }),
    ]);

    // Regroupement par mois (clé "YYYY-MM", cf. lib/groupByMonth). Calcul en UTC
    // pour ne pas dépendre du fuseau du serveur.
    const parMoisMap = new Map<string, { total: number; count: number }>();
    for (const c of creditsPourMois) {
      const d = c.dateDebut ? new Date(c.dateDebut) : null;
      const valid = d != null && !isNaN(d.getTime());
      const key = valid
        ? `${d!.getUTCFullYear()}-${String(d!.getUTCMonth() + 1).padStart(2, "0")}`
        : "0000-00";
      const e = parMoisMap.get(key) ?? { total: 0, count: 0 };
      e.total += Number(c.montantTotal);
      e.count += 1;
      parMoisMap.set(key, e);
    }
    const parMois: Record<string, { total: number; count: number }> = Object.fromEntries(parMoisMap);

    return NextResponse.json({
      data: credits,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), parMois },
    });
  } catch (error) {
    console.error("GET /api/rvc/credits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/rvc/credits
 * Crée un CreditClient directement en statut ACTIF (pas de validation requise).
 * Génère également l'échéancier immédiatement.
 */
export async function POST(req: Request) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const body = await req.json();
    const { clientId, pointDeVenteId, lignes, formule, dateDebut, tauxPenalite, garantie, observations,
      fraisDossier, assurance, autresFrais, fraisLivraison, tauxInteret, delaiGraceJours,
      garantNom, garantTelephone, garantAdresse, garantTypeGarantie, garantValeurEstimee } = body;

    if (!clientId || !lignes?.length || !dateDebut) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants (clientId, lignes, dateDebut)" },
        { status: 400 }
      );
    }
    // Formule commerciale obligatoire (module POPC) : elle détermine la durée et la
    // collecte de rémunération (16ème / 31ème). QUINZAINE → 16 échéances, TRENTAINE → 31.
    if (!estFormuleValide(formule)) {
      return NextResponse.json(
        { error: "Formule requise : QUINZAINE ou TRENTAINE" },
        { status: 400 }
      );
    }
    const dureeJours = dureeJoursPourFormule(formule);

    // Résoudre le PDV du RVC (nécessaire pour vérifier les stocks)
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    let rvcPdvId: number | null = pointDeVenteId ? Number(pointDeVenteId) : null;
    if (!rvcPdvId && !isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      rvcPdvId = aff?.pointDeVenteId ?? null;
    }

    // Avantages fidélité (CDC §19.D) : réduction frais de dossier selon le niveau.
    const fidelite = await getFidelite(Number(clientId));
    const reductionPct = fidelite.avantages.reductionFraisDossier;

    const result = await prisma.$transaction(async (tx) => {
      // Vérifier le client
      const client = await tx.client.findUnique({
        where: { id: Number(clientId) },
        select: { id: true, nom: true, prenom: true, etat: true, niveauRisque: true, limiteCredit: true, soldeActuel: true },
      });
      if (!client) throw new Error("CLIENT_INTROUVABLE");
      if (client.etat !== MemberStatus.ACTIF) throw new Error("CLIENT_INACTIF");
      if (client.limiteCredit !== null && client.soldeActuel !== null) {
        if (Number(client.soldeActuel) >= Number(client.limiteCredit)) throw new Error("LIMITE_CREDIT_ATTEINTE");
      }
      if (client.niveauRisque === NiveauRisque.CRITIQUE) {
        const enRetard = await tx.creditClient.findFirst({
          where: { clientId: client.id, statut: StatutCredit.EN_RETARD },
          select: { id: true },
        });
        if (enRetard) throw new Error("CLIENT_CRITIQUE_EN_RETARD");
      }

      // Calcul montant
      const lignesInput = lignes as { produitId?: number; produitNom: string; quantite: number; prixUnitaire: number; remise?: number }[];
      // Prix CRÉDIT résolu depuis le catalogue (§4) pour les produits référencés —
      // autoritaire (§15) ; les produits saisis libres gardent le prix fourni.
      const lignesCalc = await Promise.all(lignesInput.map(async (l) => {
        const qte = Number(l.quantite);
        const rem = Number(l.remise || 0);
        let pu    = Number(l.prixUnitaire);
        if (l.produitId) {
          const produit = await tx.produit.findUnique({
            where: { id: Number(l.produitId) },
            select: { id: true, prixUnitaire: true, categorieId: true, familleId: true, marqueId: true },
          });
          if (produit) {
            const tarif = await tariferLigne(produit, qte, { pointDeVenteId: rvcPdvId, aCredit: true });
            pu = tarif.prixUnitaire;
          }
        }
        return { ...l, qte, pu, rem, montantLigne: Number((pu * qte - rem).toFixed(2)) };
      }));

      const valeurProduits = Number(lignesCalc.reduce((s, l) => s + l.montantLigne, 0).toFixed(2));
      if (valeurProduits <= 0) throw new Error("MONTANT_INVALIDE");

      const fraisDossierBrut = Math.max(0, Number(fraisDossier ?? 0));
      const reductionFideliteFrais = reductionPct > 0
        ? Number((fraisDossierBrut * reductionPct / 100).toFixed(2))
        : 0;
      const fraisDossierN   = Number((fraisDossierBrut - reductionFideliteFrais).toFixed(2));
      const assuranceN      = Math.max(0, Number(assurance ?? 0));
      const autresFraisN    = Math.max(0, Number(autresFrais ?? 0));
      const fraisLivraisonN = Math.max(0, Number(fraisLivraison ?? 0));
      const tauxInteretN    = Math.max(0, Number(tauxInteret ?? 0));
      const montantInteret = Number((valeurProduits * tauxInteretN / 100).toFixed(2));
      const montantTotal = Number((valeurProduits + fraisDossierN + assuranceN + autresFraisN + fraisLivraisonN + montantInteret).toFixed(2));

      const duree = Number(dureeJours);
      const debut = new Date(dateDebut);
      const maintenant = new Date();
      const montantJournalier = montantJournalierArrondi(montantTotal, duree);
      const dateEcheanceFin = new Date(debut);
      dateEcheanceFin.setDate(dateEcheanceFin.getDate() + duree);

      // ── Détection des ruptures de stock ────────────────────────────────────
      // Pour chaque ligne avec produitId, vérifier le stock au PDV du RVC
      type RuptureInfo = { produitId: number; produitNom: string; quantiteDemandee: number; stockDispo: number; manque: number };
      const ruptures: RuptureInfo[] = [];

      if (rvcPdvId) {
        const produitIds = lignesCalc
          .filter((l) => l.produitId)
          .map((l) => Number(l.produitId));

        if (produitIds.length > 0) {
          const stocks = await tx.stockSite.findMany({
            where: { produitId: { in: produitIds }, pointDeVenteId: rvcPdvId },
            select: { produitId: true, quantite: true, quantiteReservee: true, produit: { select: { nom: true } } },
          });
          const stockMap = new Map(stocks.map((s) => [s.produitId, {
            quantite:         s.quantite,
            quantiteReservee: s.quantiteReservee,
            nom:              s.produit.nom,
          }]));

          for (const l of lignesCalc) {
            if (!l.produitId) continue;
            const stockInfo = stockMap.get(Number(l.produitId));
            // Disponible = quantite physique - déjà réservé par d'autres crédits
            const stockDispo = Math.max(0, (stockInfo?.quantite ?? 0) - (stockInfo?.quantiteReservee ?? 0));
            if (l.qte > stockDispo) {
              ruptures.push({
                produitId:        Number(l.produitId),
                produitNom:       stockInfo?.nom ?? l.produitNom,
                quantiteDemandee: l.qte,
                stockDispo,
                manque:           l.qte - stockDispo,
              });
            }
          }
        }
      }

      // Référence unique
      const dateStr = maintenant.toISOString().slice(0, 10).replace(/-/g, "");
      const count = await tx.creditClient.count();
      const reference = `CRD-${dateStr}-${String(count + 1).padStart(4, "0")}`;

      // Création directe en ACTIF
      const credit = await tx.creditClient.create({
        data: {
          reference,
          clientId: client.id,
          pointDeVenteId: rvcPdvId,
          statut: StatutCredit.ACTIF,
          formule,
          montantTotal,
          montantRembourse: 0,
          soldeRestant: montantTotal,
          dureeJours: duree,
          dateDebut: debut,
          dateEcheanceFin,
          montantJournalier,
          fraisDossier:   fraisDossierN,
          reductionFideliteFrais,
          assurance:      assuranceN,
          autresFrais:    autresFraisN,
          fraisLivraison: fraisLivraisonN,
          tauxInteret:    tauxInteretN,
          montantInteret,
          tauxPenalite: tauxPenalite != null ? Number(tauxPenalite) : 0,
          delaiGraceJours: delaiGraceJours != null ? Math.max(0, Number(delaiGraceJours)) : 0,
          garantie: garantie || null,
          garantNom:           garantNom || null,
          garantTelephone:     garantTelephone || null,
          garantAdresse:       garantAdresse || null,
          garantTypeGarantie:  garantTypeGarantie || null,
          garantValeurEstimee: garantValeurEstimee != null ? Math.max(0, Number(garantValeurEstimee)) : 0,
          observations: observations || null,
          creeParId: userId,
          valideParId: userId,
          dateValidation: maintenant,
          lignes: {
            create: lignesCalc.map((l) => ({
              produitId:        l.produitId ? Number(l.produitId) : null,
              produitNom:       l.produitNom,
              produitNomSaisi:  l.produitNom,
              quantite:         l.qte,
              prixUnitaire:     l.pu,
              remise:           l.rem,
              montantLigne:     l.montantLigne,
              statut:           "EN_ATTENTE" as const,
              estNouveauProduit: !l.produitId,
              pointDeVenteId:   rvcPdvId,
            })),
          },
        },
      });

      // Génération de l'échéancier (une échéance par jour)
      const totalCalculated = Number((montantJournalier * duree).toFixed(2));
      const residuel        = Number((montantTotal - totalCalculated).toFixed(2));

      const echeancesData = [];
      for (let i = 1; i <= duree; i++) {
        const dateEch = new Date(debut);
        dateEch.setDate(dateEch.getDate() + (i - 1));
        echeancesData.push({
          creditId:       credit.id,
          numeroEcheance: i,
          dateEcheance:   dateEch,
          montantDu:      i === duree
            ? Number((montantJournalier + residuel).toFixed(2))
            : montantJournalier,
        });
      }
      if (echeancesData.length > 0) {
        await tx.echeanceCredit.createMany({ data: echeancesData });
      }

      // Mise à jour du solde client
      await tx.client.update({
        where: { id: client.id },
        data: { soldeActuel: { increment: montantTotal } },
      });

      // ── Réservation de stock pour les lignes non-en-rupture ────────────────
      // Le stock physique (quantite) ne sera débité qu'à la livraison physique (magasinier).
      if (rvcPdvId) {
        const ruptureIds = new Set(ruptures.map((r) => r.produitId));
        const lignesSansRupture = lignesCalc.filter(
          (l) => l.produitId && !ruptureIds.has(Number(l.produitId))
        );

        for (const l of lignesSansRupture) {
          const pid = Number(l.produitId!);
          await tx.stockSite.upsert({
            where: { produitId_pointDeVenteId: { produitId: pid, pointDeVenteId: rvcPdvId } },
            update: { quantiteReservee: { increment: l.qte } },
            create: { produitId: pid, pointDeVenteId: rvcPdvId, quantite: 0, quantiteReservee: l.qte },
          });
        }
      }

      // Audit
      await auditLog(tx, userId, "CREATION_CREDIT_RVC", "CreditClient", credit.id);

      // ── Notification : crédit créé ─────────────────────────────────────────
      const nbSansRupture = lignesCalc.filter(l => l.produitId && !ruptures.find(r => r.produitId === Number(l.produitId))).length;
      const msgAdmin = nbSansRupture > 0
        ? `Crédit ${reference} (${montantTotal.toLocaleString("fr-FR")} FCFA) pour ${client.prenom} ${client.nom}. ${nbSansRupture} produit(s) à livrer physiquement au client.`
        : `Crédit ${reference} (${montantTotal.toLocaleString("fr-FR")} FCFA) créé pour ${client.prenom} ${client.nom}.`;

      await notifyAdmins(tx, {
        titre:    `Nouveau crédit RVC — ${reference}`,
        message:  msgAdmin,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/credits`,
      });

      // Notifier le magasinier pour les lignes disponibles en stock (livraison physique requise)
      if (nbSansRupture > 0) {
        await notifyRoles(tx, ["MAGAZINIER"], {
          titre:    `Livraison requise — crédit ${reference}`,
          message:  `${nbSansRupture} produit(s) à livrer physiquement au client ${client.prenom} ${client.nom} suite au crédit ${reference} (PDV${rvcPdvId ? ` #${rvcPdvId}` : ""}).`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/admin/credits`,
        });
      }

      // ── Commande interne de réappro si ruptures détectées ─────────────────
      let commandeInterne: { id: number; reference: string } | null = null;

      if (ruptures.length > 0 && rvcPdvId) {
        // Seules les lignes avec produitId peuvent alimenter une CommandeInterne
        const lignesCommande = ruptures.filter((r) => r.produitId != null);

        if (lignesCommande.length > 0) {
          const pdvInfo = await tx.pointDeVente.findUnique({
            where: { id: rvcPdvId },
            select: { nom: true },
          });

          const cmdRef = `CMD-INT-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

          const cmd = await tx.commandeInterne.create({
            data: {
              reference:      cmdRef,
              statut:         "SOUMISE",
              demandeurId:    userId,
              pointDeVenteId: rvcPdvId,
              notes: `Réappro automatique — crédit ${reference} pour ${client.prenom} ${client.nom}. ${
                ruptures.length !== lignesCommande.length
                  ? `(${ruptures.length - lignesCommande.length} produit(s) hors catalogue non inclus)`
                  : ""
              }`.trim(),
              lignes: {
                create: lignesCommande.map((r) => ({
                  produitId:        r.produitId as number,
                  quantiteDemandee: r.manque,
                })),
              },
            },
          });

          await auditLog(tx, userId, "COMMANDE_INTERNE_CREEE_RVC", "CommandeInterne", cmd.id);

          // Notifier logistique + magasinier + admins avec HAUTE priorité
          await notifyRoles(
            tx,
            ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "MAGAZINIER"],
            {
              titre:    `Réappro requis — ${cmdRef}`,
              message:  `Crédit ${reference} (${client.prenom} ${client.nom}${pdvInfo ? `, PDV ${pdvInfo.nom}` : ""}) créé avec ${lignesCommande.length} produit(s) en stock insuffisant. Commande interne soumise automatiquement. Quantités à approvisionner : ${
                lignesCommande.map((r) => `${r.produitNom} ×${r.manque}`).join(", ")
              }.`,
              priorite: PrioriteNotification.HAUTE,
              actionUrl: `/dashboard/logistique/commandes-internes/${cmd.id}`,
            }
          );

          commandeInterne = { id: cmd.id, reference: cmdRef };
        }
      }

      return { credit, ruptures, commandeInterne };
    });

    return NextResponse.json({
      data:             result.credit,
      ruptures:         result.ruptures,
      commandeInterne:  result.commandeInterne,  // null si pas de rupture ou pas de produitId
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/rvc/credits", error);
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CLIENT_INTROUVABLE:         ["Client introuvable", 404],
        CLIENT_INACTIF:             ["Ce client n'est pas actif", 422],
        LIMITE_CREDIT_ATTEINTE:     ["La limite de crédit de ce client est atteinte", 422],
        CLIENT_CRITIQUE_EN_RETARD:  ["Client en risque CRITIQUE avec un crédit en retard", 422],
        MONTANT_INVALIDE:           ["Le montant total des lignes doit être positif", 400],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
