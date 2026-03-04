import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT /api/rpv/clients/[id]
 * Modifie les informations d'un client.
 * Body: { nom?, prenom?, telephone?, adresse? }
 */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = parseInt(id);

    const existing = await prisma.client.findUnique({ where: { id: clientId } });
    if (!existing) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    const { nom, prenom, telephone, adresse } = await req.json();

    // Vérifier doublon téléphone si changement
    if (telephone && telephone !== existing.telephone) {
      const dup = await prisma.client.findUnique({ where: { telephone } });
      if (dup) return NextResponse.json({ error: "Ce numéro est déjà utilisé par un autre client" }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.client.update({
        where: { id: clientId },
        data: {
          ...(nom       && { nom }),
          ...(prenom    && { prenom }),
          ...(telephone && { telephone }),
          adresse: adresse !== undefined ? (adresse || null) : existing.adresse,
        },
      });
      await auditLog(tx, parseInt(session.user.id), "CLIENT_MODIFIE", "Client", c.id);
      return c;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/rpv/clients/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
