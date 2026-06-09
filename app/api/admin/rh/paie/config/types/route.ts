import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET  /api/admin/rh/paie/config/types  — liste tous les types de composants personnalisés
 * POST /api/admin/rh/paie/config/types  — crée ou met à jour un type
 *   Body: { id?, code, libelle, categorie, isRetenue?, actif? }
 *   categorie : "PRIME" | "COMMISSION" | "RETENUE" | "INDEMNITE" | "BONUS"
 */

export async function GET(_req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const types = await prisma.typeComposantPaie.findMany({
      orderBy: [{ categorie: "asc" }, { libelle: "asc" }],
    });
    return NextResponse.json({ data: types });
  } catch (error) {
    console.error("GET /api/admin/rh/paie/config/types", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, code, libelle, categorie, isRetenue, actif } = await req.json();

    if (!libelle?.trim() || !categorie?.trim()) {
      return NextResponse.json({ error: "libelle et categorie sont obligatoires" }, { status: 400 });
    }

    if (id) {
      const updated = await prisma.typeComposantPaie.update({
        where: { id: Number(id) },
        data: { libelle, categorie, isRetenue: isRetenue ?? undefined, actif: actif ?? undefined },
      });
      return NextResponse.json({ data: updated });
    }

    if (!code?.trim()) {
      return NextResponse.json({ error: "code est obligatoire pour la création" }, { status: 400 });
    }

    const type = await prisma.typeComposantPaie.create({
      data: { code: code.trim().toUpperCase(), libelle, categorie, isRetenue: isRetenue ?? false },
    });
    return NextResponse.json({ data: type }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/paie/config/types", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
