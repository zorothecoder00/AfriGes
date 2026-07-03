import { NextResponse } from "next/server";
import { StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { appliquerNouvelleDureeCredit } from "@/lib/dureeCredit";
import { resolveRvcPdv } from "@/lib/gestionnaireCredit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/rvc/credits/[id]
 * Détail d'un crédit (scoped au PDV du RVC)
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });
      rvcPdvId = aff.pointDeVenteId;
    }

    const credit = await prisma.creditClient.findUnique({
      where: { id: creditId },
      include: {
        client:    { select: {
          id: true, nom: true, prenom: true, codeClient: true, telephone: true,
          sexe: true, adresse: true, quartier: true, activite: true, nomCommerce: true, numeroCNI: true, numeroCarteAfrisime: true,
          agentTerrain:  { select: { nom: true, prenom: true, telephone: true } },
          pointDeVente:  { select: { nom: true, code: true } },
          pointsDeVente: { select: { pointDeVente: { select: { nom: true, code: true } } } },
        } },
        creePar:   { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
        gestionnaireCredit: { select: { id: true, nom: true, prenom: true } },
        lignes: {
          orderBy: { id: "asc" },
          include: {
            produit:          { select: { id: true, nom: true, reference: true } },
            produitSubstitut: { select: { id: true, nom: true } },
            traitePar:        { select: { id: true, nom: true, prenom: true } },
          },
        },
        echeances:      { orderBy: { numeroEcheance: "asc" } },
        remboursements: {
          orderBy: { dateRemboursement: "desc" },
          include: {
            enregistrePar:   { select: { id: true, nom: true, prenom: true } },
            agentCollecteur: { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
    });

    if (!credit) return NextResponse.json({ error: "Crédit introuvable" }, { status: 404 });
    if (rvcPdvId !== null && credit.pointDeVenteId !== rvcPdvId) {
      return NextResponse.json({ error: "Accès refusé — PDV non autorisé" }, { status: 403 });
    }

    const rvcPdv = await resolveRvcPdv(credit.pointDeVenteId);
    return NextResponse.json({ data: { ...credit, rvcPdv } });
  } catch (error) {
    console.error("GET /api/rvc/credits/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/rvc/credits/[id]
 *
 * Modifie les métadonnées d'un crédit (durée, date début, garantie, observations).
 * Autorisé sur EN_ATTENTE_VALIDATION, ACTIF et EN_RETARD. Recalcule montantJournalier,
 * dateEcheanceFin et — pour un crédit en remboursement — régénère l'échéancier en
 * réimputant le déjà-payé (montant total et solde restant inchangés).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });
      rvcPdvId = aff.pointDeVenteId;
    }

    const body = await req.json() as {
      dureeJours?:   number;
      dateDebut?:    string;
      garantie?:     string | null;
      observations?: string | null;
      tauxPenalite?: number;
      delaiGraceJours?: number;
      fraisDossier?: number;
      assurance?: number;
      autresFrais?: number;
      fraisLivraison?: number;
      tauxInteret?: number;
      garantNom?: string | null;
      garantTelephone?: string | null;
      garantAdresse?: string | null;
      garantTypeGarantie?: string | null;
      garantValeurEstimee?: number;
    };

    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.creditClient.findUnique({
        where: { id: creditId },
        select: {
          id: true, statut: true, pointDeVenteId: true, clientId: true,
          montantTotal: true, montantRembourse: true, dureeJours: true, dateDebut: true,
          fraisDossier: true, assurance: true, autresFrais: true, fraisLivraison: true, tauxInteret: true, montantInteret: true,
        },
      });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");
      // « En remboursement » = ACTIF ou EN_RETARD : l'échéancier existe et est régénéré
      // (avec réimputation du déjà-payé). EN_ATTENTE_VALIDATION reste éditable aussi.
      const estEnRemboursement = credit.statut === StatutCredit.ACTIF || credit.statut === StatutCredit.EN_RETARD;
      if (credit.statut !== StatutCredit.EN_ATTENTE_VALIDATION && !estEnRemboursement) throw new Error("CREDIT_NON_MODIFIABLE");
      if (rvcPdvId !== null && credit.pointDeVenteId !== rvcPdvId) throw new Error("ACCES_REFUSE");

      // ── Frais / intérêts → recomposition du montant total à rembourser ──
      const toucheFrais = body.fraisDossier !== undefined || body.assurance !== undefined || body.autresFrais !== undefined || body.fraisLivraison !== undefined || body.tauxInteret !== undefined;
      let nouveauMontantTotal: number | undefined;
      let nouveauMontantInteret: number | undefined;
      if (toucheFrais) {
        // Interdit si le crédit a déjà des remboursements (fausserait le suivi).
        if (Number(credit.montantRembourse) > 0) throw new Error("ACTIF_AVEC_REMBOURSEMENT");
        const fraisD  = body.fraisDossier   !== undefined ? Math.max(0, Number(body.fraisDossier))   : Number(credit.fraisDossier);
        const assur   = body.assurance      !== undefined ? Math.max(0, Number(body.assurance))      : Number(credit.assurance);
        const autres  = body.autresFrais    !== undefined ? Math.max(0, Number(body.autresFrais))    : Number(credit.autresFrais);
        const fraisLiv = body.fraisLivraison !== undefined ? Math.max(0, Number(body.fraisLivraison)) : Number(credit.fraisLivraison);
        const tauxInt = body.tauxInteret    !== undefined ? Math.max(0, Number(body.tauxInteret))    : Number(credit.tauxInteret);
        const ancienFraisTotal = Number(credit.fraisDossier) + Number(credit.assurance) + Number(credit.autresFrais) + Number(credit.fraisLivraison) + Number(credit.montantInteret);
        const valeurProduits = Number((Number(credit.montantTotal) - ancienFraisTotal).toFixed(2));
        nouveauMontantInteret = Number((valeurProduits * tauxInt / 100).toFixed(2));
        nouveauMontantTotal   = Number((valeurProduits + fraisD + assur + autres + fraisLiv + nouveauMontantInteret).toFixed(2));
        if (nouveauMontantTotal <= 0) throw new Error("MONTANT_INVALIDE");
      }

      const updated = await appliquerNouvelleDureeCredit(tx, credit, { ...body, montantTotal: nouveauMontantTotal });

      // Répercuter un changement de montant total sur le solde du client (crédit en cours).
      if (estEnRemboursement && nouveauMontantTotal != null) {
        const delta = Number((nouveauMontantTotal - Number(credit.montantTotal)).toFixed(2));
        if (delta !== 0) {
          await tx.client.update({ where: { id: credit.clientId }, data: { soldeActuel: { increment: delta } } });
        }
      }

      // Métadonnées bordereau (garant, délai de grâce, pénalité) — sans impact montant/échéancier.
      const meta: Record<string, unknown> = {};
      if (body.tauxPenalite       !== undefined) meta.tauxPenalite    = Number(body.tauxPenalite);
      if (body.delaiGraceJours    !== undefined) meta.delaiGraceJours = Math.max(0, Number(body.delaiGraceJours));
      if (body.fraisDossier       !== undefined) meta.fraisDossier    = Math.max(0, Number(body.fraisDossier));
      if (body.assurance          !== undefined) meta.assurance       = Math.max(0, Number(body.assurance));
      if (body.autresFrais        !== undefined) meta.autresFrais     = Math.max(0, Number(body.autresFrais));
      if (body.fraisLivraison     !== undefined) meta.fraisLivraison  = Math.max(0, Number(body.fraisLivraison));
      if (body.tauxInteret        !== undefined) meta.tauxInteret     = Math.max(0, Number(body.tauxInteret));
      if (nouveauMontantInteret   != null)       meta.montantInteret  = nouveauMontantInteret;
      if (body.garantNom          !== undefined) meta.garantNom          = body.garantNom || null;
      if (body.garantTelephone    !== undefined) meta.garantTelephone    = body.garantTelephone || null;
      if (body.garantAdresse      !== undefined) meta.garantAdresse      = body.garantAdresse || null;
      if (body.garantTypeGarantie !== undefined) meta.garantTypeGarantie = body.garantTypeGarantie || null;
      if (body.garantValeurEstimee !== undefined) meta.garantValeurEstimee = Math.max(0, Number(body.garantValeurEstimee));
      if (Object.keys(meta).length > 0) {
        await tx.creditClient.update({ where: { id: creditId }, data: meta });
      }

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:    ["Crédit introuvable", 404],
        CREDIT_NON_MODIFIABLE: ["Seuls les crédits en attente de validation, actifs ou en retard peuvent être modifiés", 422],
        ACCES_REFUSE:          ["Accès refusé — PDV non autorisé", 403],
        DUREE_INVALIDE:        ["La durée doit être ≥ 1 jour", 400],
        ACTIF_AVEC_REMBOURSEMENT: ["Ce crédit a déjà des remboursements : frais et intérêt non modifiables (le montant total serait faussé).", 422],
        MONTANT_INVALIDE:      ["Le montant total doit être positif", 400],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
    }
    console.error("PATCH /api/rvc/credits/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
