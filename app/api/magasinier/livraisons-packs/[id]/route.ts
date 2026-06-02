import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { notifyRoles, notify, auditLog } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/magasinier/livraisons-packs/[id]
 * action: "livrer" → confirme la sortie physique des produits du stock
 *   - Décrémente le StockSite du PDV du magasinier
 *   - Crée les MouvementStock correspondants
 *   - Passe la réception à LIVREE
 *   - Notifie admin + RPV que les produits sont partis
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { action, livreurNom } = body;

    if (action !== "livrer") {
      return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    }

    // PDV du magasinier
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });

    const reception = await prisma.receptionProduitPack.findUnique({
      where: { id: parseInt(id) },
      include: {
        lignes: true,
        souscription: {
          include: {
            pack: { select: { nom: true, type: true, dureeJours: true, frequenceVersement: true } },
            client: { select: { nom: true, prenom: true, pointDeVenteId: true } },
            user:   { select: { nom: true, prenom: true } },
          },
        },
      },
    });

    if (!reception) return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
    if (reception.statut !== "PLANIFIEE") {
      return NextResponse.json({ error: `Cette livraison est déjà ${reception.statut.toLowerCase()}` }, { status: 400 });
    }

    const souscription = reception.souscription;
    const magasinierNom = `${session.user.prenom} ${session.user.nom}`;
    const clientNom = souscription.client
      ? `${souscription.client.prenom} ${souscription.client.nom}`
      : souscription.user
      ? `${souscription.user.prenom} ${souscription.user.nom}`
      : "Client";

    // PDV effectif pour la sortie stock :
    // Priorité au PDV défini sur la livraison (choisi par l'admin/RPV à la planification),
    // sinon fallback sur le PDV d'affectation du magasinier.
    const effectivePdvId = reception.pointDeVenteId ?? aff?.pointDeVenteId ?? null;

    // Vérification stock sur le PDV effectif (avant transaction)
    for (const ligne of reception.lignes) {
      if (!ligne.produitId) continue;
      const stockSite = await prisma.stockSite.findFirst({
        where: {
          produitId: ligne.produitId,
          ...(effectivePdvId != null ? { pointDeVenteId: effectivePdvId } : {}),
        },
      });
      const dispo = (stockSite?.quantite ?? 0) - (stockSite?.quantiteReservee ?? 0);
      if (dispo < ligne.quantite) {
        const produit = await prisma.produit.findUnique({ where: { id: ligne.produitId }, select: { nom: true } });
        return NextResponse.json(
          { error: `Stock insuffisant pour "${produit?.nom}"${effectivePdvId ? ` sur le PDV concerné` : ""} : ${dispo} disponible(s), ${ligne.quantite} demandé(s)` },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Décrémenter le stock depuis le PDV effectif (livraison ou magasinier) ou tous PDV (greedy)
      for (const ligne of reception.lignes) {
        if (!ligne.produitId) continue;
        const sites = effectivePdvId
          ? await tx.stockSite.findMany({
              where: { produitId: ligne.produitId, pointDeVenteId: effectivePdvId, quantite: { gt: 0 } },
            })
          : await tx.stockSite.findMany({
              where: { produitId: ligne.produitId, quantite: { gt: 0 } },
              orderBy: { quantite: "desc" },
            });

        let remaining = ligne.quantite;
        for (const site of sites) {
          if (remaining <= 0) break;
          const dec = Math.min(site.quantite, remaining);
          await tx.stockSite.update({ where: { id: site.id }, data: { quantite: { decrement: dec } } });
          remaining -= dec;
        }

        await tx.mouvementStock.create({
          data: {
            produitId:       ligne.produitId,
            pointDeVenteId:  effectivePdvId,
            type:            "SORTIE",
            typeSortie:      "LIVRAISON_CLIENT",
            quantite:        ligne.quantite,
            prixUnitaire:    ligne.prixUnitaire, // prix de vente au client (snapshot de LigneReceptionPack)
            motif:           `Livraison Pack ${souscription.pack.nom} — client ${clientNom}`,
            reference:       `PACK-MAG-${reception.souscriptionId}-REC-${reception.id}-${Date.now()}`,
            operateurId:     parseInt(session.user.id),
            souscriptionId:  reception.souscriptionId,
          },
        });
      }

      const rec = await tx.receptionProduitPack.update({
        where: { id: reception.id },
        data: {
          statut:       "LIVREE",
          dateLivraison: new Date(),
          ...(livreurNom ? { livreurNom } : { livreurNom: magasinierNom }),
        },
      });

      await auditLog(tx, parseInt(session.user.id), "LIVRAISON_PACK_LIVREE", "ReceptionProduitPack", rec.id);

      // Notifier le RPV du PDV concerné (ou tous les RPV si pas de PDV explicite)
      if (effectivePdvId) {
        const pdvInfo = await tx.pointDeVente.findUnique({
          where: { id: effectivePdvId },
          select: { rpvId: true, nom: true },
        });
        const notifPayload = {
          titre:    `Produits sortis — ${souscription.pack.nom}`,
          message:  `${magasinierNom} a confirmé la sortie des produits pour ${clientNom} (souscription #${souscription.id}). La livraison est prête.`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: "/dashboard/user/responsablesPointsDeVente",
        };
        if (pdvInfo?.rpvId) {
          await notify(tx, [pdvInfo.rpvId], notifPayload);
        } else {
          await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE"], notifPayload);
        }
      } else {
        await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE"], {
          titre:    `Produits sortis — ${souscription.pack.nom}`,
          message:  `${magasinierNom} a confirmé la sortie des produits pour ${clientNom} (souscription #${souscription.id}). La livraison est prête.`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: "/dashboard/user/responsablesPointsDeVente",
        });
      }

      // Renouvellement de cycle pour FAMILIAL et EPARGNE_PRODUIT
      if (souscription.pack.type === "FAMILIAL") {
        const freq = (souscription.frequenceVersement ?? souscription.pack.frequenceVersement ?? "HEBDOMADAIRE") as string;
        const duree = souscription.pack.dureeJours ?? 30;
        const step = freq === "QUOTIDIEN" ? 1 : freq === "HEBDOMADAIRE" ? 7 : freq === "BIMENSUEL" ? 14 : 30;
        const count = Math.ceil(duree / step);
        const montantTotal = Number(souscription.montantTotal);
        const montantEcheance = Math.round((montantTotal / count) * 100) / 100;
        const debut = new Date();

        await tx.echeancePack.deleteMany({ where: { souscriptionId: souscription.id } });
        await tx.echeancePack.createMany({
          data: Array.from({ length: count }, (_, i) => {
            const date = new Date(debut);
            date.setDate(date.getDate() + (i + 1) * step);
            return {
              souscriptionId: souscription.id,
              numero: i + 1,
              montant: i === count - 1
                ? Math.round((montantTotal - montantEcheance * (count - 1)) * 100) / 100
                : montantEcheance,
              datePrevue: date,
              statut: "EN_ATTENTE" as const,
            };
          }),
        });
        await tx.souscriptionPack.update({
          where: { id: souscription.id },
          data: { montantVerse: 0, montantRestant: montantTotal, statut: "ACTIF", dateCloture: null, dateDebut: debut },
        });
      } else if (souscription.pack.type === "EPARGNE_PRODUIT") {
        await tx.echeancePack.deleteMany({ where: { souscriptionId: souscription.id } });
        await tx.souscriptionPack.update({
          where: { id: souscription.id },
          data: { montantVerse: 0, montantRestant: Number(souscription.montantTotal), statut: "EN_ATTENTE", dateCloture: null, dateDebut: new Date() },
        });
      }

      return rec;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/magasinier/livraisons-packs/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
