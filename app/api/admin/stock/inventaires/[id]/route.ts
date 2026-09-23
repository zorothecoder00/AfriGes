import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { chargerDetailInventaire, validerInventaire, rejeterInventaire } from "@/lib/inventaireServer";

type Ctx = { params: Promise<{ id: string }> };

async function getAdminSession() {
  const s = await getAuthSession();
  if (!s) return null;
  if (s.user.role !== "ADMIN" && s.user.role !== "SUPER_ADMIN") return null;
  return s;
}

/**
 * GET /api/admin/stock/inventaires/[id]
 * Détail d'un inventaire : lignes, écarts valorisés, stock actuel vs stock figé.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const inv = await chargerDetailInventaire(Number(id));
    if (!inv) return NextResponse.json({ error: "Inventaire introuvable" }, { status: 404 });
    return NextResponse.json({ data: inv });
  } catch (error) {
    console.error("GET /api/admin/stock/inventaires/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/stock/inventaires/[id]
 * Body: { action: "VALIDER" | "REJETER", commentaire? }
 *
 * - VALIDER : SOUMIS → VALIDE, écarts appliqués au stock (lib/inventaireServer.ts)
 * - REJETER : SOUMIS → EN_COURS (recomptage), motif obligatoire, réalisateur notifié
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const { action, commentaire } = await req.json();
    const validateur = {
      id:  parseInt(session.user.id),
      nom: `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim() || "L'administrateur",
    };

    if (action === "VALIDER") {
      const data = await prisma.$transaction(
        tx => validerInventaire(tx, Number(id), validateur, commentaire),
        { timeout: 30000 },
      );
      return NextResponse.json({ data });
    }

    if (action === "REJETER") {
      if (!commentaire || !String(commentaire).trim()) {
        return NextResponse.json({ error: "Le motif du rejet est obligatoire" }, { status: 400 });
      }
      const data = await prisma.$transaction(tx => rejeterInventaire(tx, Number(id), validateur, String(commentaire)));
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Action invalide : VALIDER ou REJETER" }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("PATCH /api/admin/stock/inventaires/[id]:", error);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
