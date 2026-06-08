import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/avantages/[id]
 * Body: { libelle?, montantMensuel?, dateFin?, notes?, actif? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { libelle, montantMensuel, dateFin, notes, actif } = body;

    const avantage = await prisma.avantageRH.findUnique({ where: { id: Number(id) } });
    if (!avantage) return NextResponse.json({ error: "Avantage introuvable" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (libelle        !== undefined) data.libelle        = libelle;
    if (montantMensuel !== undefined) data.montantMensuel = Number(montantMensuel);
    if (dateFin        !== undefined) data.dateFin        = dateFin ? new Date(dateFin) : null;
    if (notes          !== undefined) data.notes          = notes ?? null;
    if (actif          !== undefined) data.actif          = Boolean(actif);

    const updated = await prisma.avantageRH.update({ where: { id: Number(id) }, data });
    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "AvantageRH", entiteId: Number(id), details: `Avantage #${id} mis à jour` },
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/avantages/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
