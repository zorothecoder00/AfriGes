import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

const selProduit = { id: true, nom: true, codeProduit: true, prixUnitaire: true, statut: true, imagePrincipaleUrl: true } as const;

/**
 * Produits de substitution (Catalogue Ent.#4) — admin.
 * GET  — équivalents configurés pour ce produit + leur disponibilité (stock),
 *        et le stock du produit lui-même (pour savoir s'il est en rupture).
 * POST — ajoute un lien de substitution (substitutId, priorité, bidirectionnel).
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const liens = await prisma.produitSubstitut.findMany({
    where: { produitId },
    orderBy: [{ priorite: "desc" }, { createdAt: "asc" }],
    select: { id: true, priorite: true, bidirectionnel: true, note: true, substitut: { select: selProduit } },
  });

  const ids = liens.map((l) => l.substitut.id);
  const [stockSubs, monStock] = await Promise.all([
    ids.length ? prisma.stockSite.groupBy({ by: ["produitId"], where: { produitId: { in: ids } }, _sum: { quantite: true } }) : Promise.resolve([]),
    prisma.stockSite.aggregate({ where: { produitId }, _sum: { quantite: true } }),
  ]);
  const stockMap = new Map(stockSubs.map((s) => [s.produitId, s._sum.quantite ?? 0]));

  const configures = liens.map((l) => {
    const stock = stockMap.get(l.substitut.id) ?? 0;
    return {
      id: l.id, priorite: l.priorite, bidirectionnel: l.bidirectionnel, note: l.note,
      substitut: { ...l.substitut, prixUnitaire: Number(l.substitut.prixUnitaire) },
      stock, disponible: stock > 0 && l.substitut.statut === "ACTIF",
    };
  });

  return NextResponse.json({ data: { stockProduit: monStock._sum.quantite ?? 0, configures } });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const substitutId = Number(body?.substitutId);
  if (!substitutId) return NextResponse.json({ message: "Produit de substitution requis" }, { status: 400 });
  if (substitutId === produitId) return NextResponse.json({ message: "Un produit ne peut pas être son propre substitut" }, { status: 400 });

  const substitut = await prisma.produit.findUnique({ where: { id: substitutId }, select: { id: true } });
  if (!substitut) return NextResponse.json({ message: "Produit de substitution introuvable" }, { status: 404 });

  const doublon = await prisma.produitSubstitut.findUnique({ where: { produitId_substitutId: { produitId, substitutId } }, select: { id: true } });
  if (doublon) return NextResponse.json({ message: "Ce produit est déjà un substitut" }, { status: 409 });

  const userId = Number(session.user.id);
  const created = await prisma.$transaction(async (tx) => {
    const l = await tx.produitSubstitut.create({
      data: {
        produitId, substitutId,
        priorite: Number(body?.priorite) || 0,
        bidirectionnel: body?.bidirectionnel === undefined ? true : Boolean(body?.bidirectionnel),
        note: typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null,
        creeParId: userId,
      },
      select: { id: true },
    });
    await auditLog(tx, userId, "SUBSTITUT_AJOUTE", "Produit", produitId);
    return l;
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
