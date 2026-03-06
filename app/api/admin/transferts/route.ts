import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notifyAdmins, notify, auditLog } from "@/lib/notifications";
import { randomUUID } from "crypto";

/**
 * GET /api/admin/transferts
 * Liste des transferts de stock (pour l'admin)
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut");

    const where = statut ? { statut: statut as never } : {};

    const [transferts, total] = await Promise.all([
      prisma.transfertStock.findMany({
        where,
        include: {
          origine:      { select: { id: true, nom: true, code: true, type: true } },
          destination:  { select: { id: true, nom: true, code: true, type: true } },
          creePar:      { select: { id: true, nom: true, prenom: true } },
          validePar:    { select: { id: true, nom: true, prenom: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true, unite: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transfertStock.count({ where }),
    ]);

    return NextResponse.json({
      data: transferts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/transferts error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/transferts
 * Créer un transfert de stock d'un PDV/dépôt vers un autre.
 * - Décrémente le stock source immédiatement
 * - Crée un MouvementStock SORTIE (TRANSFERT_SORTANT) pour chaque ligne
 * - Notifie le personnel du PDV destination
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await req.json();
    const { origineId, destinationId, lignes, notes } = body;

    if (!origineId || !destinationId || !Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json({ error: "Données invalides : origineId, destinationId et lignes sont requis" }, { status: 400 });
    }
    if (Number(origineId) === Number(destinationId)) {
      return NextResponse.json({ error: "L'origine et la destination doivent être différentes" }, { status: 400 });
    }

    const adminId = parseInt(session.user.id);

    const transfert = await prisma.$transaction(async (tx) => {
      // Fetch PDV names for messages
      const [origine, destination] = await Promise.all([
        tx.pointDeVente.findUnique({ where: { id: Number(origineId) }, select: { id: true, nom: true } }),
        tx.pointDeVente.findUnique({ where: { id: Number(destinationId) }, select: { id: true, nom: true } }),
      ]);
      if (!origine)      throw new Error("PDV source introuvable");
      if (!destination)  throw new Error("PDV destination introuvable");

      // Validate stock availability on source for every line
      for (const ligne of lignes) {
        const produit = await tx.produit.findUnique({
          where: { id: Number(ligne.produitId) },
          select: { nom: true },
        });
        if (!produit) throw new Error(`Produit #${ligne.produitId} introuvable`);

        const stockSite = await tx.stockSite.findUnique({
          where: { produitId_pointDeVenteId: { produitId: Number(ligne.produitId), pointDeVenteId: Number(origineId) } },
          select: { quantite: true },
        });
        const disponible = stockSite?.quantite ?? 0;
        if (Number(ligne.quantite) > disponible) {
          throw new Error(
            `Stock insuffisant pour "${produit.nom}" sur ${origine.nom} : ${disponible} disponible(s), ${ligne.quantite} demandé(s)`
          );
        }
        if (Number(ligne.quantite) <= 0) {
          throw new Error(`La quantité doit être > 0 pour "${produit.nom}"`);
        }
      }

      // Create TransfertStock record
      const ref = `TRF-${randomUUID().slice(0, 8).toUpperCase()}`;
      const newTransfert = await tx.transfertStock.create({
        data: {
          reference:    ref,
          statut:       "EN_COURS",
          origineId:    Number(origineId),
          destinationId: Number(destinationId),
          creeParId:    adminId,
          notes:        notes || null,
          lignes: {
            create: lignes.map((l: { produitId: number; quantite: number; prixUnit?: number }) => ({
              produitId: Number(l.produitId),
              quantite:  Number(l.quantite),
              prixUnit:  l.prixUnit ? Number(l.prixUnit) : null,
            })),
          },
        },
      });

      // Decrement source stock (greedy) + create SORTIE movements
      for (const ligne of lignes) {
        const sites = await tx.stockSite.findMany({
          where: { produitId: Number(ligne.produitId), pointDeVenteId: Number(origineId), quantite: { gt: 0 } },
          orderBy: { quantite: "desc" },
        });
        let remaining = Number(ligne.quantite);
        for (const site of sites) {
          if (remaining <= 0) break;
          const dec = Math.min(site.quantite, remaining);
          await tx.stockSite.update({ where: { id: site.id }, data: { quantite: { decrement: dec } } });
          remaining -= dec;
        }

        await tx.mouvementStock.create({
          data: {
            produitId:       Number(ligne.produitId),
            pointDeVenteId:  Number(origineId),
            type:            "SORTIE",
            typeSortie:      "TRANSFERT_SORTANT",
            quantite:        Number(ligne.quantite),
            motif:           `Transfert vers ${destination.nom} (réf. ${ref})`,
            reference:       `${ref}-S-${ligne.produitId}-${randomUUID().slice(0, 8)}`,
            operateurId:     adminId,
            transfertStockId: newTransfert.id,
          },
        });
      }

      // Notify staff of destination PDV (RPV, Magasinier, Agent Logistique)
      const affectations = await tx.gestionnaireAffectation.findMany({
        where: {
          pointDeVenteId: Number(destinationId),
          actif: true,
          user: {
            gestionnaire: {
              role: { in: ["RESPONSABLE_POINT_DE_VENTE", "MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"] as never[] },
              actif: true,
            },
          },
        },
        select: { userId: true },
      });
      const destStaffIds = affectations.map((a) => a.userId);

      await notify(tx, destStaffIds, {
        titre:    `Transfert de stock entrant — ${destination.nom}`,
        message:  `Un transfert (réf. ${ref}) depuis ${origine.nom} est en attente de votre confirmation. Veuillez vérifier et confirmer la réception.`,
        priorite: "HAUTE",
        actionUrl: `/dashboard/transferts`,
      });

      await notifyAdmins(tx, {
        titre:    `Transfert créé — ${ref}`,
        message:  `Transfert de stock de "${origine.nom}" vers "${destination.nom}" initié avec succès. En attente de confirmation du personnel destination.`,
        priorite: "NORMAL",
        actionUrl: `/dashboard/admin/stock`,
      });

      await auditLog(tx, adminId, "TRANSFERT_STOCK_CREE", "TransfertStock", newTransfert.id);

      return newTransfert;
    });

    return NextResponse.json({ data: transfert }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("POST /api/admin/transferts error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
