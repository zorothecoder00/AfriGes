import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { obtenirOuCreerCompteAuxiliaireClient, obtenirOuCreerCompteAuxiliaireFournisseur } from "@/lib/comptabilite/auxiliaire";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * GET /api/comptable/auxiliaires?type=CLIENT|FOURNISSEUR&search=...
 * Recherche un client ou fournisseur et indique s'il a déjà un compte auxiliaire
 * comptable (CDC §16-17).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const type = req.nextUrl.searchParams.get("type");
    const search = (req.nextUrl.searchParams.get("search") || "").trim();

    if (type === "FOURNISSEUR") {
      const fournisseurs = await prisma.fournisseur.findMany({
        where: search ? { nom: { contains: search, mode: "insensitive" } } : {},
        select: {
          id: true, nom: true, code: true,
          compteAuxiliaire: { select: { id: true, numero: true } },
        },
        take: 30,
        orderBy: { nom: "asc" },
      });
      return NextResponse.json({ data: fournisseurs });
    }

    const clients = await prisma.client.findMany({
      where: search
        ? { OR: [{ nom: { contains: search, mode: "insensitive" } }, { prenom: { contains: search, mode: "insensitive" } }] }
        : {},
      select: {
        id: true, nom: true, prenom: true, codeClient: true,
        compteAuxiliaire: { select: { id: true, numero: true } },
      },
      take: 30,
      orderBy: { nom: "asc" },
    });
    return NextResponse.json({ data: clients });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/auxiliaires
 * Body: { type: "CLIENT"|"FOURNISSEUR", id: number }
 * Crée (ou retourne) le compte auxiliaire du tiers.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { type, id } = body as { type?: string; id?: number };
    if (!type || !id) return NextResponse.json({ error: "type et id requis" }, { status: 400 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const compte = await prisma.$transaction(async (tx) => {
      const c = type === "FOURNISSEUR"
        ? await obtenirOuCreerCompteAuxiliaireFournisseur(tx, Number(id))
        : await obtenirOuCreerCompteAuxiliaireClient(tx, Number(id));
      await auditLog(tx, userId, "OBTENTION_COMPTE_AUXILIAIRE", "CompteComptable", c.id, { type, tiersId: Number(id), numero: c.numero }, meta);
      return c;
    });

    return NextResponse.json({ data: compte }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
