import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.regleComptable.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });

    const body = await req.json();
    const {
      evenement, moduleSource, compteDebitNumero, compteCreditNumero, journal,
      conditionProduit, conditionFamille, conditionModePaiement,
      priorite, actif, mode, notes,
    } = body;

    const updated = await prisma.regleComptable.update({
      where: { id: Number(id) },
      data: {
        ...(evenement !== undefined && { evenement: String(evenement).trim() }),
        ...(moduleSource !== undefined && { moduleSource: String(moduleSource).trim() }),
        ...(compteDebitNumero !== undefined && { compteDebitNumero: String(compteDebitNumero).trim() }),
        ...(compteCreditNumero !== undefined && { compteCreditNumero: String(compteCreditNumero).trim() }),
        ...(journal !== undefined && { journal }),
        ...(conditionProduit !== undefined && { conditionProduit: conditionProduit || null }),
        ...(conditionFamille !== undefined && { conditionFamille: conditionFamille || null }),
        ...(conditionModePaiement !== undefined && { conditionModePaiement: conditionModePaiement || null }),
        ...(priorite !== undefined && { priorite: Number(priorite) }),
        ...(actif !== undefined && { actif: Boolean(actif) }),
        ...(mode !== undefined && { mode }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.regleComptable.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });

    await prisma.regleComptable.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
