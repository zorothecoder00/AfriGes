import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET  /api/admin/rh/paie/config/commissions  — liste les barèmes
 * POST /api/admin/rh/paie/config/commissions  — crée ou met à jour un barème
 *   Body: {
 *     id?,
 *     libelle,
 *     profilCible,   // rôle gestionnaire : "COMMERCIAL", "AGENT_TERRAIN"…
 *     type,          // "FIXE" | "POURCENTAGE" | "PALIER"
 *     valeur?,       // pour FIXE (montant) et POURCENTAGE (taux en %)
 *     paliers?,      // [{min, max, taux}] pour PALIER
 *     actif?
 *   }
 */

export async function GET(_req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const baremes = await prisma.baremeCommission.findMany({
      orderBy: [{ profilCible: "asc" }, { libelle: "asc" }],
    });
    return NextResponse.json({ data: baremes });
  } catch (error) {
    console.error("GET /api/admin/rh/paie/config/commissions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, libelle, profilCible, type, valeur, paliers, actif } = await req.json();

    if (!libelle?.trim() || !profilCible?.trim() || !type?.trim()) {
      return NextResponse.json({ error: "libelle, profilCible et type sont obligatoires" }, { status: 400 });
    }

    if (!["FIXE", "POURCENTAGE", "PALIER"].includes(type)) {
      return NextResponse.json({ error: "type doit être FIXE, POURCENTAGE ou PALIER" }, { status: 400 });
    }

    const data = {
      libelle,
      profilCible,
      type,
      valeur:  valeur !== undefined ? Number(valeur) : null,
      paliers: paliers ?? null,
      actif:   actif !== undefined ? Boolean(actif) : undefined,
    };

    if (id) {
      const updated = await prisma.baremeCommission.update({ where: { id: Number(id) }, data });
      return NextResponse.json({ data: updated });
    }

    const bareme = await prisma.baremeCommission.create({ data: { ...data, actif: true } });
    return NextResponse.json({ data: bareme }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/paie/config/commissions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
