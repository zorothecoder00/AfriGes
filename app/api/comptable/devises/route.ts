import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { getOuCreerDeviseFonctionnelle } from "@/lib/comptabilite/societe";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * GET /api/comptable/devises
 * Devises paramétrables (CDC §49) — jamais de taux codé en dur. XOF (devise
 * fonctionnelle, taux=1) auto-créée si absente.
 */
export async function GET() {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    await getOuCreerDeviseFonctionnelle(prisma, "XOF");
    const devises = await prisma.devise.findMany({ orderBy: { code: "asc" } });
    return NextResponse.json({ data: devises });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/devises
 * Body: { code, nom, symbole, tauxVersFonctionnelle }
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { code, nom, symbole, tauxVersFonctionnelle } = body as {
      code?: string; nom?: string; symbole?: string; tauxVersFonctionnelle?: number;
    };
    if (!code?.trim() || !nom?.trim() || !symbole?.trim()) {
      return NextResponse.json({ error: "code, nom et symbole sont requis" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const devise = await prisma.$transaction(async (tx) => {
      const d = await tx.devise.create({
        data: {
          code: code.trim().toUpperCase(),
          nom: nom.trim(),
          symbole: symbole.trim(),
          tauxVersFonctionnelle: tauxVersFonctionnelle ?? 1,
          dateTauxMaj: new Date(),
        },
      });
      await auditLog(tx, userId, "CREATION_DEVISE", "Devise", undefined, { code: d.code, nom: d.nom }, meta);
      return d;
    });
    return NextResponse.json({ data: devise }, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ce code de devise existe déjà" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
