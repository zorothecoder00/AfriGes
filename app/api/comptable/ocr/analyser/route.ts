// app/api/comptable/ocr/analyser/route.ts
//
// CDC IA/Automatisation §51 — étape 1 : reconnaissance heuristique d'une
// facture fournisseur PDF déjà uploadée en pièce justificative (nature
// FACTURE). Ne crée AUCUNE écriture comptable : produit uniquement une
// PROPOSITION que le comptable relit/corrige (POST /ocr/[id]/valider) ou
// rejette (POST /ocr/[id]/rejeter).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { extraireDonneesFacture } from "@/lib/ocrFacture";
import { resoudreRegleComptable } from "@/lib/comptabilite/moteur";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

export const runtime = "nodejs";

/**
 * POST /api/comptable/ocr/analyser
 * Body: { pieceJustificativeId: number }
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const pieceJustificativeId = Number(body?.pieceJustificativeId);
    if (!pieceJustificativeId) return NextResponse.json({ error: "pieceJustificativeId requis" }, { status: 400 });

    const piece = await prisma.pieceJustificative.findUnique({ where: { id: pieceJustificativeId } });
    if (!piece) return NextResponse.json({ error: "Pièce justificative introuvable" }, { status: 404 });

    const dejaAnalysee = await prisma.propositionImputationOCR.findUnique({ where: { pieceJustificativeId } });
    if (dejaAnalysee) return NextResponse.json({ data: dejaAnalysee });

    // Télécharge le PDF depuis l'URL uploadthing (déjà stockée à l'upload).
    const reponse = await fetch(piece.url);
    if (!reponse.ok) return NextResponse.json({ error: "Impossible de récupérer le fichier" }, { status: 502 });
    const buffer = Buffer.from(await reponse.arrayBuffer());

    const extrait = await extraireDonneesFacture(buffer);

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const proposition = await prisma.$transaction(async (tx) => {
      // Tentative de correspondance fournisseur (nom détecté ⊂ Fournisseur.nom).
      const fournisseur = extrait.fournisseurDetecte
        ? await tx.fournisseur.findFirst({
            where: { nom: { contains: extrait.fournisseurDetecte.slice(0, 30), mode: "insensitive" } },
            select: { id: true },
          })
        : null;

      // "Compte probable" (CDC §51) : le moteur central résout le couple de
      // comptes achat/fournisseur habituel — jamais figé en dur ici.
      let compteDebitProbable: string | null = null;
      let compteCreditProbable: string | null = null;
      const regle = await resoudreRegleComptable(tx, "RECEPTION_ACHAT_VALIDEE", {});
      if (regle) {
        compteDebitProbable = regle.compteDebitNumero;
        compteCreditProbable = regle.compteCreditNumero;
      }

      const p = await tx.propositionImputationOCR.create({
        data: {
          pieceJustificativeId,
          fournisseurDetecte: extrait.fournisseurDetecte,
          fournisseurIdMatche: fournisseur?.id ?? null,
          dateDetectee: extrait.dateDetectee,
          numeroDetecte: extrait.numeroDetecte,
          montantHT: extrait.montantHT,
          montantTVA: extrait.montantTVA,
          montantTTC: extrait.montantTTC,
          lignesJson: extrait.lignes.length > 0 ? extrait.lignes : undefined,
          compteDebitProbable,
          compteCreditProbable,
          statut: "ANALYSE",
          analyseParId: userId,
        },
      });
      await auditLog(tx, userId, "OCR_FACTURE_ANALYSEE", "PropositionImputationOCR", p.id, { pieceJustificativeId }, meta);
      return p;
    });

    return NextResponse.json({ data: proposition }, { status: 201 });
  } catch (e) {
    console.error("POST /api/comptable/ocr/analyser", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
