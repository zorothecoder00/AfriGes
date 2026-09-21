import { NextRequest, NextResponse } from "next/server";
import { PrioriteNotification, TypeSortieStock } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";
import { resolveViewAs } from "@/lib/viewAs";
import { getSeuilVisaBonSortie } from "@/lib/parametresDocuments";

/**
 * GET /api/magasinier/bons-sortie
 * Liste des bons de sortie du PDV du magasinier connecté.
 * Query: statut, typeSortie, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;
    const { searchParams } = new URL(req.url);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (isAdmin && !viewAs) {
      // Admin natif (Centre de commandement / page admin dédiée) : pas de PDV
      // propre à résoudre — filtre optionnel, sinon vue consolidée toutes agences.
      const pdvParam = searchParams.get("pointDeVenteId");
      if (pdvParam) where.pointDeVenteId = Number(pdvParam);
    } else {
      const effectiveUserId = viewAs?.userId ?? parseInt(session.user.id);
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: effectiveUserId, actif: true },
        select: { pointDeVenteId: true },
      });
      const pdvId = aff?.pointDeVenteId;
      if (!pdvId) {
        return NextResponse.json({ error: "Aucun point de vente associé à ce magasinier" }, { status: 400 });
      }
      where.pointDeVenteId = pdvId;
    }

    const page       = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit      = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip       = (page - 1) * limit;
    const statut     = searchParams.get("statut")    || "";
    const typeSortie = searchParams.get("typeSortie") || "";

    if (statut)     where.statut     = statut;
    if (typeSortie) where.typeSortie = typeSortie;

    const [bons, total] = await Promise.all([
      prisma.bonSortie.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          pointDeVente: { select: { id: true, nom: true, code: true } },
          creePar:      { select: { id: true, nom: true, prenom: true } },
          validePar:    { select: { id: true, nom: true, prenom: true } },
          visePar:      { select: { id: true, nom: true, prenom: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true, reference: true, prixUnitaire: true } } },
          },
          bonPreparation: { include: { lignes: { include: { produit: { select: { id: true, nom: true } } } }, preparateur: { select: { id: true, nom: true, prenom: true } } } },
          bonLivraison: { select: { id: true, reference: true } },
        },
      }),
      prisma.bonSortie.count({ where }),
    ]);

    const seuilVisaBonSortie = await getSeuilVisaBonSortie();
    const pdvs = isAdmin
      ? await prisma.pointDeVente.findMany({ where: { actif: true }, select: { id: true, nom: true, code: true }, orderBy: { nom: "asc" } })
      : undefined;

    return NextResponse.json({
      data: bons,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      seuilVisaBonSortie,
      pdvs,
    });
  } catch (error) {
    console.error("GET /magasinier/bons-sortie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/magasinier/bons-sortie
 * Créer un bon de sortie exceptionnel et déduire le stock du PDV concerné.
 * Body: { pointDeVenteId, typeSortie, motif, notes?, lignes: [{produitId, quantite}] }
 * typeSortie valides : PERTE | CASSE | DON | CONSOMMATION_INTERNE
 * (LIVRAISON_CLIENT refusé : généré uniquement par les flux de vente/livraison)
 */
export async function POST(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { typeSortie, motif, notes, lignes, commentaireEcart } = body;

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    let pointDeVenteId: number;
    if (isAdmin && body.pointDeVenteId) {
      // Admin natif (Centre de commandement / page admin dédiée) : pas de PDV
      // propre à résoudre — le PDV concerné est choisi explicitement dans le formulaire.
      pointDeVenteId = Number(body.pointDeVenteId);
    } else {
      // Résoudre le PDV du magasinier — ignorer tout pointDeVenteId du body
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: parseInt(session.user.id), actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff?.pointDeVenteId) {
        return NextResponse.json({ error: "Aucun point de vente associé à ce magasinier" }, { status: 400 });
      }
      pointDeVenteId = aff.pointDeVenteId;
    }

    if (!typeSortie || !motif || !lignes?.length) {
      return NextResponse.json(
        { error: "typeSortie, motif et lignes sont obligatoires" },
        { status: 400 }
      );
    }

    // LIVRAISON_CLIENT n'est jamais créable à la main : ces bons sont générés par
    // leur flux source (vente crédit, livraison pack, commande client) qui porte la
    // contrepartie commerciale. Un bon libre sortirait du stock sans vente ni créance.
    if (typeSortie === "LIVRAISON_CLIENT") {
      return NextResponse.json(
        { error: "Un bon de sortie « Livraison client » ne peut pas être créé manuellement : il est généré automatiquement par la vente, la commande client ou la livraison de pack concernée." },
        { status: 400 }
      );
    }

    const typesValides: TypeSortieStock[] = ["PERTE", "CASSE", "DON", "CONSOMMATION_INTERNE"];
    if (!typesValides.includes(typeSortie as TypeSortieStock)) {
      return NextResponse.json(
        { error: `typeSortie invalide. Valeurs acceptées : ${typesValides.join(", ")}` },
        { status: 400 }
      );
    }

    // Écart quantité demandée / quantité sortie (CDC §3.4) — commentaire obligatoire.
    type LigneInput = { produitId: number; quantite: number; quantiteDemandee?: number };
    const lignesInput = lignes as LigneInput[];
    const aUnEcart = lignesInput.some((l) => Number(l.quantiteDemandee ?? l.quantite) > Number(l.quantite));
    if (aUnEcart && !String(commentaireEcart || "").trim()) {
      return NextResponse.json(
        { error: "La quantité sortie est inférieure à la quantité demandée sur au moins une ligne : un commentaire d'écart est obligatoire" },
        { status: 400 }
      );
    }

    // Vérifier stocks avant transaction
    for (const l of lignesInput) {
      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: Number(l.produitId), pointDeVenteId: Number(pointDeVenteId) } },
        include: { produit: { select: { nom: true } } },
      });
      const qteDispo = (stock?.quantite ?? 0) - (stock?.quantiteReservee ?? 0);
      if (!stock || qteDispo < Number(l.quantite)) {
        return NextResponse.json(
          { error: `Stock insuffisant pour "${stock?.produit.nom ?? l.produitId}". Disponible : ${qteDispo}, demandé : ${l.quantite}` },
          { status: 400 }
        );
      }
    }

    const isLivraisonClient = typeSortie === "LIVRAISON_CLIENT";
    const seuilVisa = await getSeuilVisaBonSortie();

    const bonSortie = await prisma.$transaction(async (tx) => {
      const ref = `BS-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

      // Récupérer prix unitaires pour les lignes
      const produitsData = await Promise.all(
        lignesInput.map(l =>
          tx.produit.findUnique({ where: { id: Number(l.produitId) }, select: { id: true, nom: true, prixUnitaire: true } })
        )
      );
      const montantTotal = lignesInput.reduce(
        (s, l, i) => s + Number(l.quantite) * Number(produitsData[i]?.prixUnitaire ?? 0),
        0
      );
      const visaRequis = montantTotal > seuilVisa;

      const bon = await tx.bonSortie.create({
        data: {
          reference:     ref,
          typeSortie:    typeSortie as TypeSortieStock,
          statut:        "BROUILLON",
          pointDeVenteId:Number(pointDeVenteId),
          motif,
          notes:         notes || null,
          commentaireEcart: aUnEcart ? commentaireEcart : null,
          montantTotal,
          creeParId:     parseInt(session.user.id),
          lignes: {
            create: lignesInput.map((l, i) => ({
              produitId:        Number(l.produitId),
              quantite:         Number(l.quantite),
              quantiteDemandee: l.quantiteDemandee != null ? Number(l.quantiteDemandee) : Number(l.quantite),
              prixUnit:         produitsData[i]?.prixUnitaire ?? null,
            })),
          },
        },
        include: {
          lignes: { include: { produit: { select: { id: true, nom: true } } } },
          pointDeVente: { select: { nom: true } },
        },
      });

      // "Attestation magasinier en une seule séquence" (CDC §3.4) : sortie exécutée
      // immédiatement, SAUF si la valorisation dépasse le seuil de visa paramétré —
      // dans ce cas, un visa (RPV/Chef Agence/Direction) est requis avant exécution.
      if (!isLivraisonClient && !visaRequis) {
        for (const ligne of bon.lignes) {
          await tx.stockSite.update({
            where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: Number(pointDeVenteId) } },
            data: { quantite: { decrement: ligne.quantite } },
          });

          await tx.mouvementStock.create({
            data: {
              produitId:      ligne.produitId,
              pointDeVenteId: Number(pointDeVenteId),
              type:           "SORTIE",
              typeSortie:     typeSortie as TypeSortieStock,
              quantite:       ligne.quantite,
              motif:          `Bon de sortie ${ref} — ${motif}`,
              reference:      `${ref}-P${ligne.produitId}`,
              operateurId:    parseInt(session.user.id),
              bonSortieId:    bon.id,
            },
          });
        }

        // Marquer comme VALIDE directement (le magasinier valide à la création)
        await tx.bonSortie.update({
          where: { id: bon.id },
          data: { statut: "VALIDE", valideParId: parseInt(session.user.id), dateValidation: new Date() },
        });
      }
      // Pour LIVRAISON_CLIENT (ou toute sortie au-delà du seuil de visa) : reste en
      // BROUILLON, le stock sera décrémenté à la confirmation/validation ultérieure.

      await auditLog(tx, parseInt(session.user.id), "BON_SORTIE_CREE", "BonSortie", bon.id);

      const isPrioritaire = ["PERTE", "CASSE"].includes(typeSortie);
      await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "RESPONSABLE_POINT_DE_VENTE", "COMPTABLE"], {
        titre:    visaRequis
          ? `Visa requis sur un bon de sortie (${ref})`
          : isLivraisonClient
          ? `Livraison client en attente (${ref})`
          : `Bon de sortie ${typeSortie} (${ref})`,
        message:  visaRequis
          ? `${session.user.prenom} ${session.user.nom} a préparé un bon de sortie "${typeSortie}" (${montantTotal.toLocaleString("fr-FR")} FCFA) dépassant le seuil de validation — un visa est requis avant exécution.`
          : isLivraisonClient
          ? `${session.user.prenom} ${session.user.nom} a préparé une livraison client depuis "${bon.pointDeVente.nom}". ${bon.lignes.length} produit(s) — en attente de confirmation.`
          : `${session.user.prenom} ${session.user.nom} a émis un bon de sortie "${typeSortie}" pour "${bon.pointDeVente.nom}". ${bon.lignes.length} ligne(s). Motif : ${motif}.`,
        priorite: (isPrioritaire || visaRequis) ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/magasinier/bons-sortie/${bon.id}`,
      });

      return bon;
    });

    return NextResponse.json({ data: bonSortie }, { status: 201 });
  } catch (error) {
    console.error("POST /magasinier/bons-sortie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
