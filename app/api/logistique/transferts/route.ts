import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

async function getSession() {
  return (await getLogistiqueSession()) ?? (await getMagasinierSession());
}

/**
 * GET /api/logistique/transferts
 * Liste des transferts de stock entre PDV/dépôts.
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page    = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit   = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip    = (page - 1) * limit;
    const search    = searchParams.get("search")   || "";
    const statut    = searchParams.get("statut")   || "";
    const origineId = searchParams.get("origineId");
    const destId    = searchParams.get("destId");
    const entrants  = searchParams.get("entrants") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (entrants) {
      // Transferts à confirmer par cet utilisateur (destination = son PDV, statut EN_COURS ou EXPEDIE)
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: parseInt(session.user.id), actif: true },
        select: { pointDeVenteId: true },
      });
      if (aff?.pointDeVenteId) {
        where.destinationId = aff.pointDeVenteId;
        where.statut = { in: ["EN_COURS", "EXPEDIE"] };
      }
    } else {
      if (statut)    where.statut         = statut;
      if (origineId) where.origineId      = Number(origineId);
      if (destId)    where.destinationId  = Number(destId);
    }
    if (search)    where.OR = [
      { reference: { contains: search, mode: "insensitive" } },
      { notes:     { contains: search, mode: "insensitive" } },
    ];

    const [transferts, total, pdvs] = await Promise.all([
      prisma.transfertStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          origine:     { select: { id: true, nom: true, code: true, type: true } },
          destination: { select: { id: true, nom: true, code: true, type: true } },
          creePar:     { select: { id: true, nom: true, prenom: true } },
          validePar:   { select: { id: true, nom: true, prenom: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true, reference: true, unite: true } } },
          },
        },
      }),
      prisma.transfertStock.count({ where }),
      prisma.pointDeVente.findMany({ where: { actif: true }, select: { id: true, nom: true, code: true, type: true }, orderBy: { nom: "asc" } }),
    ]);

    return NextResponse.json({
      data: transferts,
      pdvs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /logistique/transferts:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/transferts
 * Créer un transfert de stock entre deux sites.
 * - Vérifie les stocks disponibles à l'origine
 * - Statut initial : EN_COURS
 * - La validation (RECU) se fait via PATCH /[id]
 * Body: { origineId, destinationId, notes?, lignes: [{produitId, quantite}] }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { origineId, destinationId, notes, lignes } = body;

    if (!origineId || !destinationId || !lignes?.length) {
      return NextResponse.json({ error: "origineId, destinationId et lignes sont obligatoires" }, { status: 400 });
    }
    if (Number(origineId) === Number(destinationId)) {
      return NextResponse.json({ error: "L'origine et la destination doivent être différents" }, { status: 400 });
    }

    // Vérifier stocks suffisants à l'origine
    for (const l of lignes as Array<{ produitId: number; quantite: number }>) {
      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: Number(l.produitId), pointDeVenteId: Number(origineId) } },
        include: { produit: { select: { nom: true } } },
      });
      if (!stock || stock.quantite < Number(l.quantite)) {
        return NextResponse.json(
          { error: `Stock insuffisant pour "${stock?.produit.nom ?? l.produitId}". Dispo: ${stock?.quantite ?? 0}, demandé: ${l.quantite}` },
          { status: 400 }
        );
      }
    }

    const [origine, destination] = await Promise.all([
      prisma.pointDeVente.findUnique({ where: { id: Number(origineId) }, select: { nom: true } }),
      prisma.pointDeVente.findUnique({ where: { id: Number(destinationId) }, select: { nom: true } }),
    ]);
    if (!origine || !destination) return NextResponse.json({ error: "PDV introuvable" }, { status: 404 });

    const transfert = await prisma.$transaction(async (tx) => {
      const ref = `TRF-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

      const t = await tx.transfertStock.create({
        data: {
          reference:     ref,
          statut:        "EN_COURS",
          origineId:     Number(origineId),
          destinationId: Number(destinationId),
          creeParId:     parseInt(session.user.id),
          notes:         notes || null,
          dateExpedition:new Date(),
          lignes: {
            create: lignes.map((l: { produitId: number; quantite: number }) => ({
              produitId: Number(l.produitId),
              quantite:  Number(l.quantite),
            })),
          },
        },
        include: {
          lignes: { include: { produit: { select: { nom: true } } } },
        },
      });

      // Décrémenter stock origine
      for (const l of t.lignes) {
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: Number(origineId) } },
          data: { quantite: { decrement: l.quantite } },
        });
        await tx.mouvementStock.create({
          data: {
            produitId:       l.produitId,
            pointDeVenteId:  Number(origineId),
            type:            "SORTIE",
            typeSortie:      "TRANSFERT_SORTANT",
            quantite:        l.quantite,
            motif:           `Transfert ${ref} → ${destination.nom}`,
            reference:       `${ref}-OUT-P${l.produitId}`,
            operateurId:     parseInt(session.user.id),
            transfertStockId:t.id,
          },
        });
      }

      await auditLog(tx, parseInt(session.user.id), "TRANSFERT_CREE", "TransfertStock", t.id);

      await notifyRoles(tx, ["MAGAZINIER", "RESPONSABLE_POINT_DE_VENTE"], {
        titre:    `Transfert en cours : ${ref}`,
        message:  `${session.user.prenom} ${session.user.nom} a initié un transfert de ${t.lignes.length} produit(s) de "${origine.nom}" vers "${destination.nom}".`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/logistique/transferts/${t.id}`,
      });

      return t;
    });

    return NextResponse.json({ data: transfert }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/transferts:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
