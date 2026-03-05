import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getAuthSession } from "@/lib/auth";
import { auditLog } from "@/lib/notifications";

async function getSession() {
  const logistique = await getLogistiqueSession();
  if (logistique) return logistique;
  const s = await getAuthSession();
  if (s && (s.user.role === "ADMIN" || s.user.role === "SUPER_ADMIN")) return s;
  return null;
}

/**
 * GET /api/logistique/fournisseurs
 * Liste des fournisseurs enregistrés.
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const actifQ = searchParams.get("actif");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (actifQ !== null && actifQ !== "") where.actif = actifQ === "true";
    if (search) where.OR = [
      { nom:       { contains: search, mode: "insensitive" } },
      { contact:   { contains: search, mode: "insensitive" } },
      { telephone: { contains: search, mode: "insensitive" } },
    ];

    const fournisseurs = await prisma.fournisseur.findMany({
      where,
      orderBy: { nom: "asc" },
      include: { _count: { select: { receptions: true } } },
    });

    return NextResponse.json({ data: fournisseurs });
  } catch (error) {
    console.error("GET /logistique/fournisseurs:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/fournisseurs
 * Créer un fournisseur.
 * Body: { nom, contact?, telephone?, email?, adresse?, notes? }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { nom, contact, telephone, email, adresse, notes } = await req.json();
    if (!nom) return NextResponse.json({ error: "nom est obligatoire" }, { status: 400 });

    const fournisseur = await prisma.$transaction(async (tx) => {
      const f = await tx.fournisseur.create({
        data: { nom, contact: contact || null, telephone: telephone || null, email: email || null, adresse: adresse || null, notes: notes || null },
      });
      await auditLog(tx, parseInt(session.user.id), "FOURNISSEUR_CREE", "Fournisseur", f.id);
      return f;
    });

    return NextResponse.json({ data: fournisseur }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/fournisseurs:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
