import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../../route";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/logistique/fournisseurs/[id]/contrats
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const contrats = await prisma.contratFournisseur.findMany({
      where: { fournisseurId: Number(id), actif: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: contrats });
  } catch (error) {
    console.error("GET /logistique/fournisseurs/[id]/contrats:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/fournisseurs/[id]/contrats
 * Body: { titre, reference?, dateDebut?, dateFin?, fichierUrl?, notes? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fournisseurId = Number(id);
    const fournisseur = await prisma.fournisseur.findUnique({ where: { id: fournisseurId }, select: { id: true } });
    if (!fournisseur) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });

    const { titre, reference, dateDebut, dateFin, fichierUrl, notes } = await req.json();
    if (!titre?.trim()) return NextResponse.json({ error: "titre est obligatoire" }, { status: 400 });

    const contrat = await prisma.$transaction(async (tx) => {
      const c = await tx.contratFournisseur.create({
        data: {
          fournisseurId, titre: titre.trim(),
          reference: reference || null,
          dateDebut: dateDebut ? new Date(dateDebut) : null,
          dateFin: dateFin ? new Date(dateFin) : null,
          fichierUrl: fichierUrl || null, notes: notes || null,
        },
      });
      await auditLog(tx, parseInt(session.user.id), "CONTRAT_FOURNISSEUR_CREE", "ContratFournisseur", c.id);
      return c;
    });

    return NextResponse.json({ data: contrat }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/fournisseurs/[id]/contrats:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
