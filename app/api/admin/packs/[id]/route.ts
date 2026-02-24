import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const pack = await prisma.pack.findUnique({
      where: { id: parseInt(id) },
      include: {
        souscriptions: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            user: { select: { nom: true, prenom: true } },
            client: { select: { nom: true, prenom: true, telephone: true } },
            _count: { select: { versements: true } },
          },
        },
        _count: { select: { souscriptions: true } },
      },
    });

    if (!pack) {
      return NextResponse.json({ error: "Pack introuvable" }, { status: 404 });
    }

    return NextResponse.json(pack);
  } catch (error) {
    console.error("GET /api/admin/packs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    // Bloquer la désactivation si des souscriptions sont en cours
    if (body.actif === false) {
      const actives = await prisma.souscriptionPack.count({
        where: { packId: parseInt(id), statut: { in: ["EN_ATTENTE", "ACTIF"] } },
      });
      if (actives > 0) {
        return NextResponse.json(
          { error: `Impossible de désactiver : ${actives} souscription(s) en cours sur ce pack` },
          { status: 400 }
        );
      }
    }

    const pack = await prisma.pack.update({
      where: { id: parseInt(id) },
      data: {
        nom: body.nom,
        description: body.description,
        actif: body.actif,
        dureeJours: body.dureeJours ? parseInt(body.dureeJours) : undefined,
        frequenceVersement: body.frequenceVersement,
        montantVersement: body.montantVersement ? parseFloat(body.montantVersement) : undefined,
        formuleRevendeur: body.formuleRevendeur,
        montantCredit: body.montantCredit ? parseFloat(body.montantCredit) : undefined,
        montantSeuil: body.montantSeuil ? parseFloat(body.montantSeuil) : undefined,
        bonusPourcentage: body.bonusPourcentage ? parseFloat(body.bonusPourcentage) : undefined,
        cyclesBonusTrigger: body.cyclesBonusTrigger ? parseInt(body.cyclesBonusTrigger) : undefined,
        acomptePercent: body.acomptePercent ? parseFloat(body.acomptePercent) : undefined,
        pointsParTranche: body.pointsParTranche ? parseInt(body.pointsParTranche) : undefined,
        montantTranche: body.montantTranche ? parseFloat(body.montantTranche) : undefined,
      },
    });

    return NextResponse.json(pack);
  } catch (error) {
    console.error("PUT /api/admin/packs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const packId = parseInt(id);

    // Vérifier qu'il n'y a pas de souscriptions actives
    const actives = await prisma.souscriptionPack.count({
      where: { packId, statut: { in: ["EN_ATTENTE", "ACTIF"] } },
    });

    if (actives > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer : ${actives} souscription(s) active(s)` },
        { status: 400 }
      );
    }

    await prisma.pack.delete({ where: { id: packId } });
    return NextResponse.json({ message: "Pack supprimé" });
  } catch (error) {
    console.error("DELETE /api/admin/packs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
