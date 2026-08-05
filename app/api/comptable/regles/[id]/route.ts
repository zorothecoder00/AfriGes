import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

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
      conditionProduit, conditionFamille, conditionCategorie, conditionModePaiement,
      conditionTypeClient, conditionPointDeVente, conditionTypeSortie,
      compteTvaNumero, sectionAnalytiqueId, centreCoutId, devise, dateDebutValidite, dateFinValidite,
      priorite, actif, mode, notes,
    } = body;

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.regleComptable.update({
        where: { id: Number(id) },
        data: {
          ...(evenement !== undefined && { evenement: String(evenement).trim() }),
          ...(moduleSource !== undefined && { moduleSource: String(moduleSource).trim() }),
          ...(compteDebitNumero !== undefined && { compteDebitNumero: String(compteDebitNumero).trim() }),
          ...(compteCreditNumero !== undefined && { compteCreditNumero: String(compteCreditNumero).trim() }),
          ...(journal !== undefined && { journal }),
          ...(conditionProduit !== undefined && { conditionProduit: conditionProduit || null }),
          ...(conditionFamille !== undefined && { conditionFamille: conditionFamille || null }),
          ...(conditionCategorie !== undefined && { conditionCategorie: conditionCategorie || null }),
          ...(conditionModePaiement !== undefined && { conditionModePaiement: conditionModePaiement || null }),
          ...(conditionTypeClient !== undefined && { conditionTypeClient: conditionTypeClient || null }),
          ...(conditionPointDeVente !== undefined && { conditionPointDeVente: conditionPointDeVente ? Number(conditionPointDeVente) : null }),
          ...(conditionTypeSortie !== undefined && { conditionTypeSortie: conditionTypeSortie || null }),
          ...(compteTvaNumero !== undefined && { compteTvaNumero: compteTvaNumero || null }),
          ...(sectionAnalytiqueId !== undefined && { sectionAnalytiqueId: sectionAnalytiqueId ? Number(sectionAnalytiqueId) : null }),
          ...(centreCoutId !== undefined && { centreCoutId: centreCoutId ? Number(centreCoutId) : null }),
          ...(devise !== undefined && { devise: devise || null }),
          ...(dateDebutValidite !== undefined && { dateDebutValidite: dateDebutValidite ? new Date(dateDebutValidite) : null }),
          ...(dateFinValidite !== undefined && { dateFinValidite: dateFinValidite ? new Date(dateFinValidite) : null }),
          ...(priorite !== undefined && { priorite: Number(priorite) }),
          ...(actif !== undefined && { actif: Boolean(actif) }),
          ...(mode !== undefined && { mode }),
          ...(notes !== undefined && { notes: notes || null }),
        },
      });
      await auditLog(tx, userId, "MODIFICATION_REGLE_COMPTABLE", "RegleComptable", u.id, { evenement: u.evenement }, meta);
      return u;
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.regleComptable.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    await prisma.$transaction(async (tx) => {
      await tx.regleComptable.delete({ where: { id: Number(id) } });
      await auditLog(tx, userId, "SUPPRESSION_REGLE_COMPTABLE", "RegleComptable", Number(id), { evenement: existing.evenement }, meta);
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
