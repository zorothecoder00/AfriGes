import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";
import { etatPeremption } from "@/lib/lotsFefo";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Lots d'un produit (Catalogue Ent.#5) — admin.
 * GET  — liste des lots (avec état de péremption) ordonnés FEFO.
 * POST — crée un lot (numéro, site, quantité, DLC/DLUO) + mouvement d'entrée.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const lots = await prisma.lotProduit.findMany({
    where: { produitId },
    orderBy: [{ statut: "asc" }, { dlc: { sort: "asc", nulls: "last" } }, { dateReception: "asc" }],
    select: {
      id: true, numeroLot: true, quantiteInitiale: true, quantite: true, dlc: true, dluo: true,
      dateReception: true, prixAchat: true, statut: true, notes: true,
      pointDeVente: { select: { id: true, nom: true } },
      fournisseur: { select: { id: true, nom: true } },
    },
  });

  return NextResponse.json({
    data: lots.map((l) => ({
      ...l,
      prixAchat: l.prixAchat != null ? Number(l.prixAchat) : null,
      peremption: etatPeremption(l.dlc),
    })),
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });
  const produit = await prisma.produit.findUnique({ where: { id: produitId }, select: { id: true } });
  if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Corps invalide" }, { status: 400 });

  const numeroLot = typeof body.numeroLot === "string" ? body.numeroLot.trim() : "";
  if (!numeroLot) return NextResponse.json({ message: "Le numéro de lot est requis" }, { status: 400 });
  const pointDeVenteId = Number(body.pointDeVenteId);
  if (!pointDeVenteId) return NextResponse.json({ message: "L'agence / le dépôt est requis" }, { status: 400 });
  const quantiteInitiale = Number(body.quantiteInitiale);
  if (!Number.isFinite(quantiteInitiale) || quantiteInitiale <= 0) return NextResponse.json({ message: "La quantité doit être supérieure à 0" }, { status: 400 });

  const dlc = body.dlc ? new Date(body.dlc as string) : null;
  const dluo = body.dluo ? new Date(body.dluo as string) : null;
  if (dlc && isNaN(dlc.getTime())) return NextResponse.json({ message: "DLC invalide" }, { status: 400 });
  if (dluo && isNaN(dluo.getTime())) return NextResponse.json({ message: "DLUO invalide" }, { status: 400 });

  const prixAchat = body.prixAchat != null && body.prixAchat !== "" ? Number(body.prixAchat) : null;
  const fournisseurId = body.fournisseurId ? Number(body.fournisseurId) : null;
  const userId = Number(session.user.id);

  try {
    const lot = await prisma.$transaction(async (tx) => {
      const l = await tx.lotProduit.create({
        data: {
          numeroLot, produitId, pointDeVenteId,
          quantiteInitiale: Math.round(quantiteInitiale), quantite: Math.round(quantiteInitiale),
          dlc, dluo, prixAchat: prixAchat != null ? new Prisma.Decimal(prixAchat) : null,
          fournisseurId, notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
          creeParId: userId,
        },
        select: { id: true, numeroLot: true, quantite: true },
      });
      await tx.mouvementLot.create({ data: { lotId: l.id, type: "ENTREE", quantite: l.quantite, motif: "Création du lot", operateurId: userId } });
      await auditLog(tx, userId, "LOT_CREE", "LotProduit", l.id);
      return l;
    });
    return NextResponse.json({ data: lot }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ message: "Un lot avec ce numéro existe déjà pour ce produit sur ce site" }, { status: 409 });
    }
    console.error("POST /api/admin/catalogue/produits/[id]/lots", e);
    return NextResponse.json({ message: "Erreur lors de la création du lot" }, { status: 500 });
  }
}
