import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";
import { etatStock } from "@/lib/etatStock";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Disponibilité d'un produit par agence (Catalogue §6, §7, §10).
 * GET   — pour chaque point de vente : stock (dispo/réservé/transit/endommagé),
 *         seuils, emplacement, disponibilité et état (couleur) calculé — admin.
 * PATCH — met à jour (upsert) le paramétrage d'une agence pour ce produit — admin.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const produit = await prisma.produit.findUnique({ where: { id: produitId }, select: { id: true, alerteStock: true } });
  if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

  const [pdvs, stocks] = await Promise.all([
    prisma.pointDeVente.findMany({ where: { actif: true }, orderBy: { nom: "asc" }, select: { id: true, nom: true, type: true } }),
    prisma.stockSite.findMany({ where: { produitId }, select: {
      pointDeVenteId: true, quantite: true, quantiteReservee: true, quantiteEnTransit: true, quantiteEndommagee: true,
      alerteStock: true, disponible: true, stockMin: true, stockMax: true, seuilCritique: true, rayon: true, etagere: true, allee: true,
    } }),
  ]);
  const byPdv = new Map(stocks.map((s) => [s.pointDeVenteId, s]));

  const data = pdvs.map((pdv) => {
    const s = byPdv.get(pdv.id);
    const quantite = s ? Number(s.quantite) : 0;
    const etat = etatStock({
      quantite,
      seuilCritique: s?.seuilCritique ?? null,
      stockMin: s?.stockMin ?? null,
      alerteStock: s?.alerteStock ?? produit.alerteStock ?? null,
    });
    return {
      pointDeVenteId: pdv.id, agence: pdv.nom, type: pdv.type,
      disponible: s?.disponible ?? true,
      quantite,
      reserve: s ? Number(s.quantiteReservee) : 0,
      enTransit: s?.quantiteEnTransit ?? 0,
      endommage: s?.quantiteEndommagee ?? 0,
      stockMin: s?.stockMin ?? null, stockMax: s?.stockMax ?? null, seuilCritique: s?.seuilCritique ?? null,
      rayon: s?.rayon ?? null, etagere: s?.etagere ?? null, allee: s?.allee ?? null,
      configure: !!s,
      etat,
    };
  });

  return NextResponse.json({ data });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const pointDeVenteId = Number(body?.pointDeVenteId);
  if (!pointDeVenteId) return NextResponse.json({ message: "Agence requise" }, { status: 400 });

  const intOrNull = (v: unknown) => (v === null || v === "" || v === undefined ? null : Math.max(0, Math.floor(Number(v))));
  const strOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const champs = {
    ...(typeof body.disponible === "boolean" ? { disponible: body.disponible } : {}),
    ...(body.stockMin !== undefined ? { stockMin: intOrNull(body.stockMin) } : {}),
    ...(body.stockMax !== undefined ? { stockMax: intOrNull(body.stockMax) } : {}),
    ...(body.seuilCritique !== undefined ? { seuilCritique: intOrNull(body.seuilCritique) } : {}),
    ...(body.rayon !== undefined ? { rayon: strOrNull(body.rayon) } : {}),
    ...(body.etagere !== undefined ? { etagere: strOrNull(body.etagere) } : {}),
    ...(body.allee !== undefined ? { allee: strOrNull(body.allee) } : {}),
  };
  if (Object.keys(champs).length === 0) return NextResponse.json({ message: "Aucune modification" }, { status: 400 });

  const userId = Number(session.user.id);
  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.stockSite.upsert({
      where: { produitId_pointDeVenteId: { produitId, pointDeVenteId } },
      update: champs,
      create: { produitId, pointDeVenteId, quantite: 0, ...champs },
      select: { id: true, disponible: true, stockMin: true, stockMax: true, seuilCritique: true, rayon: true, etagere: true, allee: true },
    });
    await auditLog(tx, userId, "DISPONIBILITE_AGENCE_MAJ", "Produit", produitId);
    return s;
  });

  return NextResponse.json({ data: updated });
}
