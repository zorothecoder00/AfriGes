import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../../../fournisseurs/route";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  transitaire: { select: { id: true, nom: true, code: true } },
  evenements: { orderBy: { date: "desc" as const }, include: { creePar: { select: { id: true, nom: true, prenom: true } } } },
};

/**
 * GET /api/logistique/bons-commande/[id]/importation
 * Détails de suivi import du PO (null si non renseigné — achat local).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const importation = await prisma.importation.findUnique({ where: { bonCommandeId: Number(id) }, include: INCLUDE });
    return NextResponse.json({ data: importation });
  } catch (error) {
    console.error("GET /logistique/bons-commande/[id]/importation:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/bons-commande/[id]/importation
 * Crée le suivi import (une seule fois par PO — utiliser PATCH ensuite).
 * Body: { paysOrigine?, portDepart?, portArrivee?, numeroConteneur?, incoterm?,
 *         transitaireId?, transitaireNom?, referenceDouane?, dateDedouanement?,
 *         assurancePolice?, assuranceMontant?, dateETD?, dateETA?, notes? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const bonId = Number(id);
    const bon = await prisma.bonCommande.findUnique({ where: { id: bonId } });
    if (!bon) return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 });

    const existing = await prisma.importation.findUnique({ where: { bonCommandeId: bonId } });
    if (existing) return NextResponse.json({ error: "Ce bon de commande a déjà un suivi import — utilisez la modification" }, { status: 409 });

    const body = await req.json();
    const data = buildData(body);

    const importation = await prisma.$transaction(async (tx) => {
      const imp = await tx.importation.create({ data: { ...data, bonCommandeId: bonId }, include: INCLUDE });
      await auditLog(tx, parseInt(session.user.id), "IMPORTATION_CREEE", "Importation", imp.id);
      return imp;
    });

    return NextResponse.json({ data: importation }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/bons-commande/[id]/importation:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/bons-commande/[id]/importation
 * Édition des champs de suivi import.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.importation.findUnique({ where: { bonCommandeId: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Aucun suivi import pour ce bon de commande" }, { status: 404 });

    const body = await req.json();
    const data = buildData(body);
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });

    const updated = await prisma.importation.update({ where: { id: existing.id }, data, include: INCLUDE });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /logistique/bons-commande/[id]/importation:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildData(body: any) {
  const allowed = [
    "paysOrigine", "portDepart", "portArrivee", "numeroConteneur", "incoterm",
    "transitaireNom", "referenceDouane", "assurancePolice", "notes",
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key] || null;
  }
  if ("transitaireId" in body) data.transitaireId = body.transitaireId ? Number(body.transitaireId) : null;
  if ("assuranceMontant" in body) data.assuranceMontant = body.assuranceMontant !== "" && body.assuranceMontant != null ? Number(body.assuranceMontant) : null;
  for (const dateKey of ["dateDedouanement", "dateETD", "dateETA", "dateArriveeReelle"]) {
    if (dateKey in body) data[dateKey] = body[dateKey] ? new Date(body[dateKey]) : null;
  }
  return data;
}
