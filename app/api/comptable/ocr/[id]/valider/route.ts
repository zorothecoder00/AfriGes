// app/api/comptable/ocr/[id]/valider/route.ts
//
// CDC IA/Automatisation §51 — étape 2 : le comptable a relu/corrigé la
// proposition d'imputation générée par reconnaissance heuristique et
// confirme. Crée l'écriture comptable correspondante.
//
// IMPORTANT (contrainte CDC explicite — "l'IA ne doit jamais valider seule
// une écriture comptable sensible") : `creerEcriture` est appelé ICI avec
// `statut: "BROUILLON"` câblé en dur, jamais paramétrable depuis le body de
// la requête. La validation finale (BROUILLON → VALIDE) reste l'écran normal
// des écritures (app/api/comptable/ecritures/[id]/route.ts), identique à
// toute écriture saisie manuellement — aucun raccourci pour ce chemin IA.
// Le journal et la section analytique, eux, restent proposés (jamais figés :
// CDC §63 — "propose compte, taxe, journal, analytique"), éditables par le
// comptable avant confirmation.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { creerEcriture } from "@/lib/comptabilite/moteur";
import { compteAuxiliaireOuDefaut } from "@/lib/comptabilite/auxiliaire";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/comptable/ocr/[id]/valider
 * Body (tous relus/corrigés par le comptable) :
 *   { fournisseurNom, fournisseurId?, dateFacture, numero, montantHT?, montantTVA?, montantTTC,
 *     compteDebitNumero, compteCreditNumero, compteTvaNumero? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const propositionId = Number(id);
    if (!propositionId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Corps invalide" }, { status: 400 });

    const fournisseurNom = typeof body.fournisseurNom === "string" ? body.fournisseurNom.trim() : "";
    const fournisseurId = body.fournisseurId ? Number(body.fournisseurId) : undefined;
    const numero = typeof body.numero === "string" ? body.numero.trim() : "";
    const dateFacture = body.dateFacture ? new Date(body.dateFacture) : new Date();
    const montantTTC = Number(body.montantTTC);
    const montantHT = body.montantHT != null && body.montantHT !== "" ? Number(body.montantHT) : null;
    const montantTVA = body.montantTVA != null && body.montantTVA !== "" ? Number(body.montantTVA) : null;
    const compteDebitNumero = typeof body.compteDebitNumero === "string" ? body.compteDebitNumero.trim() : "";
    const compteCreditNumero = typeof body.compteCreditNumero === "string" ? body.compteCreditNumero.trim() : "";
    const compteTvaNumero = typeof body.compteTvaNumero === "string" && body.compteTvaNumero.trim() ? body.compteTvaNumero.trim() : null;
    const journal = typeof body.journal === "string" && body.journal.trim() ? body.journal.trim() : "ACHATS";
    const sectionAnalytiqueId = body.sectionAnalytiqueId != null && body.sectionAnalytiqueId !== "" ? Number(body.sectionAnalytiqueId) : null;

    if (!fournisseurNom || !numero || !montantTTC || montantTTC <= 0 || !compteDebitNumero || !compteCreditNumero) {
      return NextResponse.json(
        { error: "fournisseurNom, numero, montantTTC (>0), compteDebitNumero et compteCreditNumero sont requis" },
        { status: 400 },
      );
    }

    const proposition = await prisma.propositionImputationOCR.findUnique({ where: { id: propositionId } });
    if (!proposition) return NextResponse.json({ error: "Proposition introuvable" }, { status: 404 });
    if (proposition.statut !== "ANALYSE") {
      return NextResponse.json({ error: `Proposition déjà ${proposition.statut === "VALIDEE" ? "validée" : "rejetée"}` }, { status: 409 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);

    const decomposeTva = montantHT != null && montantTVA != null && montantHT > 0 && montantTVA > 0 && compteTvaNumero;

    const resultat = await prisma.$transaction(async (tx) => {
      const compteCredit = await compteAuxiliaireOuDefaut(tx, compteCreditNumero, { fournisseurId });

      const ecritureId = await creerEcriture(tx, {
        journal,
        date: dateFacture,
        libelle: `Facture fournisseur — ${fournisseurNom} — ${numero}`,
        userId,
        reference: `OCR-${propositionId}`,
        // Toujours BROUILLON — voir note en tête de fichier.
        statut: "BROUILLON",
        lignes: decomposeTva
          ? [
              { numero: compteDebitNumero, debit: montantHT!, libelle: `Facture ${numero} — ${fournisseurNom}`, sectionAnalytiqueId },
              { numero: compteTvaNumero!, debit: montantTVA!, libelle: `TVA déductible — ${numero}`, isTva: true, montantTva: montantTVA!, sectionAnalytiqueId },
              { numero: compteCredit, credit: montantTTC, libelle: `Facture ${numero} — ${fournisseurNom}`, sectionAnalytiqueId },
            ]
          : [
              { numero: compteDebitNumero, debit: montantTTC, libelle: `Facture ${numero} — ${fournisseurNom}`, sectionAnalytiqueId },
              { numero: compteCredit, credit: montantTTC, libelle: `Facture ${numero} — ${fournisseurNom}`, sectionAnalytiqueId },
            ],
      });

      if (!ecritureId) throw new Error("ÉCRITURE_NON_CRÉÉE — vérifier les numéros de compte ou la clôture de période");

      const p = await tx.propositionImputationOCR.update({
        where: { id: propositionId },
        data: { statut: "VALIDEE", ecritureCreeeId: ecritureId, valideParId: userId },
      });
      await auditLog(tx, userId, "OCR_FACTURE_VALIDEE", "PropositionImputationOCR", propositionId, { ecritureId }, meta);
      return p;
    });

    return NextResponse.json({ data: resultat });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    console.error("POST /api/comptable/ocr/[id]/valider", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
