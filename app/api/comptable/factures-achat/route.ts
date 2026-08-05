import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession, getComptableLectureSession } from "@/lib/authComptable";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * GET /api/comptable/factures-achat?statut=&page=&limit=
 * POST /api/comptable/factures-achat
 * Facture fournisseur (CDC §71/§73) — trace le numéro/date de facture reçue
 * et son état de rapprochement, pour alimenter l'alerte "factures fournisseurs
 * non rapprochées" (lib/comptabilite/alertes.ts).
 */
export async function GET(req: Request) {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "comptabilite", "LECTURE");
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 50)));
    const skip = (page - 1) * limit;

    const where = statut ? { statutRapprochement: statut } : {};
    const [factures, total] = await Promise.all([
      prisma.factureAchat.findMany({
        where,
        include: { fournisseur: { select: { nom: true } }, receptionAppro: { select: { reference: true } } },
        orderBy: { dateFacture: "desc" },
        skip,
        take: limit,
      }),
      prisma.factureAchat.count({ where }),
    ]);

    return NextResponse.json({ data: factures, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "comptabilite", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const { numero, dateFacture, fournisseurId, montantTTC, receptionApproId, notes } = body;

    if (!numero || !dateFacture || !fournisseurId || !montantTTC) {
      return NextResponse.json({ error: "numero, dateFacture, fournisseurId et montantTTC sont requis" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const facture = await prisma.$transaction(async (tx) => {
      const f = await tx.factureAchat.create({
        data: {
          numero: String(numero).trim(),
          dateFacture: new Date(dateFacture),
          fournisseurId: Number(fournisseurId),
          montantTTC: Number(montantTTC),
          receptionApproId: receptionApproId ? Number(receptionApproId) : null,
          notes: notes || null,
          creeParId: userId,
        },
      });
      await auditLog(tx, userId, "CREATION_FACTURE_ACHAT", "FactureAchat", f.id, { numero: f.numero, fournisseurId: f.fournisseurId }, meta);
      return f;
    });

    return NextResponse.json({ data: facture }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
