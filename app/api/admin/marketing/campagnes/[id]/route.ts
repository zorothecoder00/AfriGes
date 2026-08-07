import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { calculerAlertesStock } from "@/lib/campagneStock";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const campagneId = Number(id);
    if (isNaN(campagneId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const campagne = await prisma.campagne.findUnique({
      where: { id: campagneId },
      include: {
        responsable: { select: { id: true, nom: true, prenom: true } },
        commercial: { select: { id: true, nom: true, prenom: true } },
        creePar: { select: { id: true, nom: true, prenom: true } },
        typeCampagne: true,
        budget: { include: { depenses: { orderBy: { date: "desc" } } } },
        objectifs: true,
        agences: { include: { pointDeVente: { select: { id: true, nom: true, code: true } } } },
        produits: { include: { produit: { select: { id: true, nom: true } }, famille: { select: { id: true, nom: true } }, pack: { select: { id: true, nom: true } } } },
        canaux: { include: { canal: true } },
        audience: { include: { regles: true } },
        ventesAttribuees: { select: { id: true, reference: true, montantTotal: true, createdAt: true } },
        creditsAttribues: { select: { id: true, reference: true, montantTotal: true, createdAt: true } },
      },
    });
    if (!campagne) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

    const alertesStock = await calculerAlertesStock(campagneId);

    const caAttribue =
      campagne.ventesAttribuees.reduce((s, v) => s + Number(v.montantTotal), 0) +
      campagne.creditsAttribues.reduce((s, c) => s + Number(c.montantTotal), 0);

    return NextResponse.json({ data: { ...campagne, alertesStock, caAttribue } });
  } catch (e) {
    console.error("GET /api/admin/marketing/campagnes/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH — édition des champs hors statut (le statut passe par /action).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const campagneId = Number(id);
    if (isNaN(campagneId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { nom, description, portee, responsableId, commercialId, brief, audienceId, dateDebut, dateFin } = body;

    const userId = Number(session.user.id);
    const updated = await prisma.$transaction(async (tx) => {
      const avant = await tx.campagne.findUnique({ where: { id: campagneId } });
      if (!avant) throw new Error("CAMPAGNE_INTROUVABLE");

      const campagne = await tx.campagne.update({
        where: { id: campagneId },
        data: {
          ...(nom !== undefined ? { nom } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(portee !== undefined ? { portee } : {}),
          ...(responsableId !== undefined ? { responsableId: Number(responsableId) } : {}),
          ...(commercialId !== undefined ? { commercialId: commercialId ? Number(commercialId) : null } : {}),
          ...(brief !== undefined ? { brief } : {}),
          ...(audienceId !== undefined ? { audienceId: audienceId ? Number(audienceId) : null } : {}),
          ...(dateDebut !== undefined ? { dateDebut: new Date(dateDebut) } : {}),
          ...(dateFin !== undefined ? { dateFin: new Date(dateFin) } : {}),
        },
      });
      await auditLog(tx, userId, "UPDATE", "Campagne", campagneId, { avant, apres: campagne });
      return campagne;
    });

    return NextResponse.json({ data: updated });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "CAMPAGNE_INTROUVABLE") {
      return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
    }
    console.error("PATCH /api/admin/marketing/campagnes/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
