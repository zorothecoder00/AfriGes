// app/api/comptable/ocr/[id]/rejeter/route.ts
//
// CDC IA/Automatisation §51 — le comptable juge la reconnaissance heuristique
// inexploitable (facture scannée illisible, mise en page inhabituelle…) et
// bascule sur une saisie manuelle classique. Aucune écriture n'est créée.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const propositionId = Number(id);
    if (!propositionId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

    const proposition = await prisma.propositionImputationOCR.findUnique({ where: { id: propositionId } });
    if (!proposition) return NextResponse.json({ error: "Proposition introuvable" }, { status: 404 });
    if (proposition.statut !== "ANALYSE") {
      return NextResponse.json({ error: `Proposition déjà ${proposition.statut === "VALIDEE" ? "validée" : "rejetée"}` }, { status: 409 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.propositionImputationOCR.update({
        where: { id: propositionId },
        data: { statut: "REJETEE", valideParId: userId },
      });
      await auditLog(tx, userId, "OCR_FACTURE_REJETEE", "PropositionImputationOCR", propositionId, undefined, meta);
      return p;
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error("POST /api/comptable/ocr/[id]/rejeter", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
