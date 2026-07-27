import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../../route";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/logistique/fournisseurs/[id]/litiges
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const litiges = await prisma.litigeFournisseur.findMany({
      where: { fournisseurId: Number(id) },
      orderBy: { createdAt: "desc" },
      include: {
        creePar: { select: { id: true, nom: true, prenom: true } },
        resoluPar: { select: { id: true, nom: true, prenom: true } },
        bonCommande: { select: { id: true, reference: true } },
      },
    });
    return NextResponse.json({ data: litiges });
  } catch (error) {
    console.error("GET /logistique/fournisseurs/[id]/litiges:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/fournisseurs/[id]/litiges
 * Signaler un litige (CDC §8 — critère d'évaluation "Litiges").
 * Body: { motif, description?, bonCommandeId? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fournisseurId = Number(id);
    const fournisseur = await prisma.fournisseur.findUnique({ where: { id: fournisseurId }, select: { id: true, nom: true } });
    if (!fournisseur) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });

    const { motif, description, bonCommandeId } = await req.json();
    if (!motif?.trim()) return NextResponse.json({ error: "motif est obligatoire" }, { status: 400 });

    const litige = await prisma.$transaction(async (tx) => {
      const l = await tx.litigeFournisseur.create({
        data: {
          fournisseurId, motif: motif.trim(),
          description: description || null,
          bonCommandeId: bonCommandeId ? Number(bonCommandeId) : null,
          creeParId: parseInt(session.user.id),
        },
      });
      await auditLog(tx, parseInt(session.user.id), "LITIGE_FOURNISSEUR_CREE", "LitigeFournisseur", l.id, { fournisseur: fournisseur.nom });
      return l;
    });

    return NextResponse.json({ data: litige }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/fournisseurs/[id]/litiges:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
