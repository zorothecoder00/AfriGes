import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notifyAdmins, notify, auditLog } from "@/lib/notifications";
import { randomUUID } from "crypto";

/**
 * GET /api/admin/approvisionnements
 * Liste paginée des réceptions d'approvisionnement (créées par l'admin)
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip  = (page - 1) * limit;
    const statut = searchParams.get("statut");
    const pdvId  = searchParams.get("pdvId");

    const where: Prisma.ReceptionApprovisionnementWhereInput = {
      ...(statut && { statut: statut as Prisma.EnumStatutReceptionApproFilter }),
      ...(pdvId  && { pointDeVenteId: Number(pdvId) }),
    };

    const [receptions, total] = await Promise.all([
      prisma.receptionApprovisionnement.findMany({
        where,
        include: {
          pointDeVente:    { select: { id: true, nom: true, code: true, type: true } },
          receptionnePar:  { select: { id: true, nom: true, prenom: true } },
          validePar:       { select: { id: true, nom: true, prenom: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true, unite: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.receptionApprovisionnement.count({ where }),
    ]);

    return NextResponse.json({
      data: receptions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/approvisionnements error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/approvisionnements
 *
 * Crée un approvisionnement direct vers un PDV ou le dépôt central.
 * L'admin crée et valide immédiatement la réception.
 *
 * Conséquences :
 *  - ReceptionApprovisionnement créée avec statut VALIDE
 *  - Stock incrémenté sur le PDV cible (StockSite upsert)
 *  - MouvementStock ENTREE créé par produit
 *  - Notification au personnel du PDV cible + admins
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await req.json();
    const { pointDeVenteId, type, fournisseurNom, lignes, notes } = body;

    if (!pointDeVenteId || !Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json(
        { error: "Données invalides : pointDeVenteId et lignes sont requis" },
        { status: 400 }
      );
    }

    const typeAppro = type === "INTERNE" ? "INTERNE" : "FOURNISSEUR";
    const adminId   = parseInt(session.user.id);
    const now       = new Date();

    const reception = await prisma.$transaction(async (tx) => {
      const pdv = await tx.pointDeVente.findUnique({
        where: { id: Number(pointDeVenteId) },
        select: { id: true, nom: true },
      });
      if (!pdv) throw new Error("Point de vente introuvable");

      // Validate all products and quantities
      for (const ligne of lignes) {
        if (!ligne.produitId) throw new Error("Un produit n'est pas spécifié");
        if (!ligne.quantite || Number(ligne.quantite) <= 0) {
          const produit = await tx.produit.findUnique({ where: { id: Number(ligne.produitId) }, select: { nom: true } });
          throw new Error(`La quantité doit être > 0 pour "${produit?.nom ?? `#${ligne.produitId}`}"`);
        }
        if (ligne.prixUnitaire !== undefined && ligne.prixUnitaire !== null && ligne.prixUnitaire !== "" && Number(ligne.prixUnitaire) < 0) {
          const produit = await tx.produit.findUnique({ where: { id: Number(ligne.produitId) }, select: { nom: true } });
          throw new Error(`Le prix unitaire ne peut pas être négatif pour "${produit?.nom ?? `#${ligne.produitId}`}"`);
        }
        const existe = await tx.produit.count({ where: { id: Number(ligne.produitId) } });
        if (!existe) throw new Error(`Produit #${ligne.produitId} introuvable`);
      }

      const ref = `APP-${randomUUID().slice(0, 8).toUpperCase()}`;

      const newReception = await tx.receptionApprovisionnement.create({
        data: {
          reference:        ref,
          type:             typeAppro,
          statut:           "VALIDE",
          pointDeVenteId:   Number(pointDeVenteId),
          fournisseurNom:   typeAppro === "FOURNISSEUR" ? (fournisseurNom || null) : null,
          datePrevisionnelle: now,
          dateReception:    now,
          controlQualite:   true,
          notes:            notes || null,
          receptionneParId: adminId,
          valideParId:      adminId,
          lignes: {
            create: lignes.map((l: { produitId: number; quantite: number; prixUnitaire?: number | string | null }) => {
              const hasPrixUnitaire = l.prixUnitaire !== undefined && l.prixUnitaire !== null && l.prixUnitaire !== "";
              return {
                produitId:        Number(l.produitId),
                quantiteAttendue: Number(l.quantite),
                quantiteRecue:    Number(l.quantite),
                prixUnitaire:     hasPrixUnitaire ? new Prisma.Decimal(Number(l.prixUnitaire)) : null,
                etatQualite:      "BON",
              };
            }),
          },
        },
      });  

      // Incrémenter StockSite + créer mouvements ENTREE
      const typeEntree = typeAppro === "INTERNE" ? "RECEPTION_INTERNE" : "RECEPTION_FOURNISSEUR";
      for (const ligne of lignes) {
        const produitId = Number(ligne.produitId);
        const hasPrixUnitaire = ligne.prixUnitaire !== undefined && ligne.prixUnitaire !== null && ligne.prixUnitaire !== "";
        const prixAchat = hasPrixUnitaire ? new Prisma.Decimal(ligne.prixUnitaire) : null;

        // 🔥 1. Mettre à jour le prix d'achat du produit
        if (hasPrixUnitaire) {
          await tx.produit.update({
            where: { id: produitId },
            data: { prixAchat: prixAchat },
          });
        }
        await tx.stockSite.upsert({
          where: { produitId_pointDeVenteId: { produitId: Number(ligne.produitId), pointDeVenteId: Number(pointDeVenteId) } },
          update: { quantite: { increment: Number(ligne.quantite) } },
          create: { produitId: Number(ligne.produitId), pointDeVenteId: Number(pointDeVenteId), quantite: Number(ligne.quantite) },
        });

        await tx.mouvementStock.create({
          data: {
            produitId,
            pointDeVenteId:    Number(pointDeVenteId),
            type:              "ENTREE",  
            typeEntree:        typeEntree as never,
            quantite:          Number(ligne.quantite),
            motif:             typeAppro === "FOURNISSEUR"
              ? `Approvisionnement fournisseur${fournisseurNom ? ` — ${fournisseurNom}` : ""} (réf. ${ref})`
              : `Réception interne (réf. ${ref})`,
            reference:         `${ref}-ENTREE-${ligne.produitId}-${Date.now()}`,
            operateurId:       adminId,
            receptionApproId:  newReception.id,
          },
        });
      }

      // Notifier le personnel du PDV cible
      const affectations = await tx.gestionnaireAffectation.findMany({
        where: {
          pointDeVenteId: Number(pointDeVenteId),
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
      await notify(tx, affectations.map((a) => a.userId), {
        titre:    `Approvisionnement reçu — ${pdv.nom}`,
        message:  `Un approvisionnement (réf. ${ref}) a été enregistré sur votre PDV. ${lignes.length} produit(s) ajouté(s) au stock.`,
        priorite: "NORMAL",
        actionUrl: `/dashboard/stock`,
      });

      await notifyAdmins(tx, {
        titre:    `Approvisionnement créé — ${ref}`,
        message:  `Approvisionnement direct vers "${pdv.nom}" (${lignes.length} produit(s)) validé avec succès.`,
        priorite: "NORMAL",
        actionUrl: `/dashboard/admin/stock`,
      });

      await auditLog(tx, adminId, "APPROVISIONNEMENT_DIRECT_ADMIN", "ReceptionApprovisionnement", newReception.id);

      return newReception;
    });

    return NextResponse.json({ data: reception }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("POST /api/admin/approvisionnements error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
