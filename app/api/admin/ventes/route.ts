import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

async function getAdminSession() {
  const s = await getAuthSession();
  if (!s) return null;
  if (s.user.role !== "ADMIN" && s.user.role !== "SUPER_ADMIN") return null;
  return s;
}

/**
 * GET /api/admin/ventes
 * Vue globale de toutes les ventes directes (tous PDV, tous vendeurs).
 * Query: pdvId, vendeurId, statut, dateDebut, dateFin, search, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip      = (page - 1) * limit;
    const search    = searchParams.get("search")    || "";
    const statut    = searchParams.get("statut")    || "";
    const pdvId     = searchParams.get("pdvId");
    const vendeurId = searchParams.get("vendeurId");
    const dateDebut = searchParams.get("dateDebut");
    const dateFin   = searchParams.get("dateFin");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut)    where.statut         = statut;
    if (pdvId)     where.pointDeVenteId = Number(pdvId);
    if (vendeurId) where.vendeurId      = Number(vendeurId);
    if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin)   where.createdAt.lte = new Date(dateFin + "T23:59:59.999Z");
    }
    if (search) where.OR = [
      { reference: { contains: search, mode: "insensitive" } },
      { clientNom: { contains: search, mode: "insensitive" } },
      { client:    { nom: { contains: search, mode: "insensitive" } } },
    ];

    const [ventes, total] = await Promise.all([
      prisma.venteDirecte.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          pointDeVente: { select: { id: true, nom: true, code: true } },
          vendeur:      { select: { id: true, nom: true, prenom: true } },
          client:       { select: { id: true, nom: true, prenom: true, telephone: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true } } },
          },
        },
      }),
      prisma.venteDirecte.count({ where }),
    ]);

    const allMontants = await prisma.venteDirecte.findMany({
      where: { ...where, statut: "CONFIRMEE" },
      select: { montantTotal: true },
    });
    const montantTotal  = allMontants.reduce((acc, v) => acc + Number(v.montantTotal), 0);
    const panierMoyen   = allMontants.length > 0 ? montantTotal / allMontants.length : 0;

    const pdvs = await prisma.pointDeVente.findMany({
      where: { actif: true }, select: { id: true, nom: true, code: true }, orderBy: { nom: "asc" },
    });

    return NextResponse.json({
      data: ventes,
      pdvs,
      stats: { total, montantTotal, panierMoyen, nbConfirmees: allMontants.length },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /admin/ventes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/ventes
 * Enregistrer une vente directe en tant qu'admin.
 */
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const body = await req.json();
    const { pointDeVenteId, modePaiement, montantPaye, clientId, clientNom, clientTelephone, notes, lignes } = body;

    if (!pointDeVenteId || !modePaiement || montantPaye === undefined || !lignes?.length) {
      return NextResponse.json({ error: "pointDeVenteId, modePaiement, montantPaye et lignes sont obligatoires" }, { status: 400 });
    }

    // Vérifier stocks et calculer montant
    let montantTotal = 0;
    for (const l of lignes as Array<{ produitId: number; quantite: number; prixUnitaire?: number }>) {
      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: Number(l.produitId), pointDeVenteId: Number(pointDeVenteId) } },
        include: { produit: { select: { nom: true, prixUnitaire: true } } },
      });
      if (!stock || stock.quantite < Number(l.quantite)) {
        return NextResponse.json(
          { error: `Stock insuffisant pour "${stock?.produit.nom ?? l.produitId}". Dispo : ${stock?.quantite ?? 0}` },
          { status: 400 }
        );
      }
      montantTotal += Number(l.quantite) * Number(l.prixUnitaire ?? stock.produit.prixUnitaire);
    }

    const pdv = await prisma.pointDeVente.findUnique({ where: { id: Number(pointDeVenteId) }, select: { nom: true } });

    const vente = await prisma.$transaction(async (tx) => {
      const ref = `VD-ADM-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const monnaieRendue = Math.max(0, Number(montantPaye) - montantTotal);

      const v = await tx.venteDirecte.create({
        data: {
          reference:       ref,
          statut:          "CONFIRMEE",
          pointDeVenteId:  Number(pointDeVenteId),
          vendeurId:       userId,
          modePaiement,
          montantTotal,
          montantPaye:     Number(montantPaye),
          monnaieRendue,
          notes:           notes || null,
          clientId:        clientId        ? Number(clientId) : null,
          clientNom:       clientNom       || null,
          clientTelephone: clientTelephone || null,
          lignes: {
            create: await Promise.all(
              (lignes as Array<{ produitId: number; quantite: number; prixUnitaire?: number }>).map(async l => {
                const produit = await tx.produit.findUnique({ where: { id: Number(l.produitId) } });
                const prix = Number(l.prixUnitaire ?? produit?.prixUnitaire ?? 0);
                return { produitId: Number(l.produitId), quantite: Number(l.quantite), prixUnitaire: prix, montant: Number(l.quantite) * prix };
              })
            ),
          },
        },
        include: { lignes: true },
      });

      for (const ligne of v.lignes) {
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: Number(pointDeVenteId) } },
          data: { quantite: { decrement: ligne.quantite } },
        });
        await tx.mouvementStock.create({
          data: {
            produitId:     ligne.produitId,
            pointDeVenteId:Number(pointDeVenteId),
            type:          "SORTIE",
            typeSortie:    "VENTE_DIRECTE",
            quantite:      ligne.quantite,
            motif:         `Vente admin ${ref}`,
            reference:     `${ref}-P${ligne.produitId}`,
            operateurId:   userId,
            venteDirecteId:v.id,
          },
        });
      }

      await auditLog(tx, userId, "VENTE_DIRECTE_ADMIN", "VenteDirecte", v.id);

      await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE", "CAISSIER", "COMPTABLE"], {
        titre:    `Vente admin : ${ref}`,
        message:  `${session.user.prenom} ${session.user.nom} (Admin) a enregistré une vente de ${montantTotal.toLocaleString("fr-FR")} FCFA sur "${pdv?.nom}".`,
        priorite: PrioriteNotification.HAUTE,
        actionUrl:`/dashboard/admin/ventes/${v.id}`,
      });

      return v;
    });

    return NextResponse.json({ data: vente }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/ventes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
