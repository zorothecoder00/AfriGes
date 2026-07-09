import { NextResponse } from "next/server";
import { Prisma, TypePrix, PorteePrix } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";
import { TYPES_PRIX } from "@/lib/tarification";

type Ctx = { params: Promise<{ id: string }> };

const PORTEES = ["GLOBAL", "AGENCE", "VILLE", "REGION"] as const;

/**
 * Lignes de prix d'un produit (Catalogue §4, Ent.#1/#2).
 * GET  — toutes les lignes de prix (avec cible géographique) — admin.
 * POST — ajoute une ligne de prix (type + montant + portée) — admin.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const prix = await prisma.prixProduit.findMany({
    where: { produitId },
    orderBy: [{ type: "asc" }, { portee: "asc" }],
    select: {
      id: true, type: true, montant: true, devise: true, portee: true, auto: true, actif: true,
      pointDeVenteId: true, ville: true, region: true, dateDebut: true, dateFin: true, createdAt: true,
      pointDeVente: { select: { id: true, nom: true } },
    },
  });

  return NextResponse.json({ data: prix.map((p) => ({ ...p, montant: Number(p.montant) })) });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });
  const exists = await prisma.produit.findUnique({ where: { id: produitId }, select: { id: true } });
  if (!exists) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const type = body?.type as TypePrix;
  if (!TYPES_PRIX.includes(type)) return NextResponse.json({ message: "Type de prix invalide" }, { status: 400 });
  const montant = Number(body?.montant);
  if (isNaN(montant) || montant < 0) return NextResponse.json({ message: "Montant invalide" }, { status: 400 });

  const portee = (PORTEES.includes(body?.portee) ? body.portee : "GLOBAL") as PorteePrix;
  const pointDeVenteId = portee === "AGENCE" && body?.pointDeVenteId ? Number(body.pointDeVenteId) : null;
  const ville = portee === "VILLE" && typeof body?.ville === "string" && body.ville.trim() ? body.ville.trim() : null;
  const region = portee === "REGION" && typeof body?.region === "string" && body.region.trim() ? body.region.trim() : null;

  if (portee === "AGENCE" && !pointDeVenteId) return NextResponse.json({ message: "Agence requise pour une portée Agence" }, { status: 400 });
  if (portee === "VILLE" && !ville) return NextResponse.json({ message: "Ville requise pour une portée Ville" }, { status: 400 });
  if (portee === "REGION" && !region) return NextResponse.json({ message: "Région requise pour une portée Région" }, { status: 400 });

  // Unicité applicative : une seule ligne active pour (produit, type, portée, cible).
  const doublon = await prisma.prixProduit.findFirst({
    where: { produitId, type, portee, pointDeVenteId, ville, region, actif: true },
    select: { id: true },
  });
  if (doublon) return NextResponse.json({ message: "Une ligne de prix existe déjà pour cette combinaison (type + portée)" }, { status: 409 });

  const userId = Number(session.user.id);
  const created = await prisma.$transaction(async (tx) => {
    const p = await tx.prixProduit.create({
      data: {
        produitId, type, montant: new Prisma.Decimal(montant), portee, pointDeVenteId, ville, region,
        dateDebut: body?.dateDebut ? new Date(body.dateDebut) : null,
        dateFin: body?.dateFin ? new Date(body.dateFin) : null,
        creeParId: userId,
      },
      select: { id: true, type: true, montant: true, portee: true },
    });
    // Miroir legacy : le prix DÉTAIL global reste synchronisé avec Produit.prixUnitaire
    // (utilisé par ventes/crédits existants), et ACHAT global avec Produit.prixAchat.
    if (portee === "GLOBAL" && type === "DETAIL") {
      await tx.produit.update({ where: { id: produitId }, data: { prixUnitaire: new Prisma.Decimal(montant) } });
    }
    if (portee === "GLOBAL" && type === "ACHAT") {
      await tx.produit.update({ where: { id: produitId }, data: { prixAchat: new Prisma.Decimal(montant) } });
    }
    await auditLog(tx, userId, "PRIX_PRODUIT_AJOUTE", "Produit", produitId);
    return p;
  });

  return NextResponse.json({ data: { ...created, montant: Number(created.montant) } }, { status: 201 });
}
