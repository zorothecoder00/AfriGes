// app/api/comptable/ocr/analyser/route.ts
//
// CDC IA/Automatisation §51 — étape 1 : reconnaissance heuristique d'une
// facture fournisseur PDF déjà uploadée en pièce justificative (nature
// FACTURE). Ne crée AUCUNE écriture comptable : produit uniquement une
// PROPOSITION que le comptable relit/corrige (POST /ocr/[id]/valider) ou
// rejette (POST /ocr/[id]/rejeter).
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { extraireDonneesFacture } from "@/lib/ocrFacture";
import { resoudreRegleComptable } from "@/lib/comptabilite/moteur";
import { resoudreTvaAchat } from "@/lib/comptabilite/tva";
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

      // "Compte probable" (CDC §51/§63) : le moteur central résout le couple de
      // comptes achat/fournisseur habituel — jamais figé en dur ici.
      let compteDebitProbable: string | null = null;
      let compteCreditProbable: string | null = null;
      let compteTvaProbable: string | null = null;
      let sectionAnalytiqueProbableId: number | null = null;
      let journalProbable = "ACHATS";
      const regle = await resoudreRegleComptable(tx, "RECEPTION_ACHAT_VALIDEE", {});
      if (regle) {
        compteDebitProbable = regle.compteDebitNumero;
        compteCreditProbable = regle.compteCreditNumero;
        journalProbable = regle.journal;
        if (regle.compteTvaNumero) compteTvaProbable = regle.compteTvaNumero;
        if (regle.sectionAnalytiqueId != null) sectionAnalytiqueProbableId = regle.sectionAnalytiqueId;
      }

      // Résolution par produit (CDC §52/§53) : chaque ligne détectée est
      // rapprochée d'un produit existant par désignation (best-effort, jamais
      // inventé), ce qui affine le compte/TVA/section analytique probables via
      // la même cascade que les autres générateurs. Simplification assumée :
      // une seule facture reste un couple compte débit/crédit global (pas de
      // ventilation par ligne) — la dernière ligne matchée l'emporte.
      const lignesEnrichies: Array<(typeof extrait.lignes)[number] & { produitIdMatche: number | null }> = [];
      for (const ligne of extrait.lignes) {
        let produitIdMatche: number | null = null;
        let produit: { id: number; categorieId: number | null; familleId: number | null } | null = null;
        if (ligne.designation) {
          produit = await tx.produit.findFirst({
            where: { nom: { contains: ligne.designation.slice(0, 30), mode: "insensitive" } },
            select: { id: true, categorieId: true, familleId: true },
          });
          produitIdMatche = produit?.id ?? null;
        }
        lignesEnrichies.push({ ...ligne, produitIdMatche });

        if (produitIdMatche != null) {
          const regleProduit = await resoudreRegleComptable(tx, "RECEPTION_ACHAT_VALIDEE", { produitId: produitIdMatche });
          if (regleProduit) {
            compteDebitProbable = regleProduit.compteDebitNumero;
            if (regleProduit.compteTvaNumero) compteTvaProbable = regleProduit.compteTvaNumero;
            if (regleProduit.sectionAnalytiqueId != null) sectionAnalytiqueProbableId = regleProduit.sectionAnalytiqueId;
          }
          // CDC §65 (tax_rules) : taxe conditionnelle par catégorie/famille du
          // produit matché, prioritaire sur le compte TVA générique ci-dessus.
          const tvaConditionnelle = await resoudreTvaAchat(tx, {
            categorieId: produit?.categorieId ?? null,
            familleId: produit?.familleId ?? null,
          });
          if (tvaConditionnelle) compteTvaProbable = tvaConditionnelle.compteDeductibleNumero;
        }
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
          lignesJson: lignesEnrichies.length > 0 ? (lignesEnrichies as unknown as Prisma.InputJsonValue) : undefined,
          compteDebitProbable,
          compteCreditProbable,
          compteTvaProbable,
          sectionAnalytiqueProbableId,
          journalProbable,
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
