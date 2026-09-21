import { prisma } from "@/lib/prisma";

/**
 * Chargement et validation de la sortie de caisse qu'une fiche de décaissement justifie
 * (règle : la fiche vient APRÈS la sortie de caisse). Partagé par POST /api/decaissements et
 * par les flux fournisseur (paiement d'un bon de commande, règlement dépôt-vente).
 */

/**
 * Justificatifs obligatoires : un demandeur ne peut pas créer une nouvelle fiche tant qu'une de ses
 * fiches payées n'a aucune pièce justificative jointe (reçu, facture…). Ne concerne que les fiches
 * créées à partir de cette date (les anciennes fiches ne bloquent personne) ; les salaires en sont exemptés.
 */
export const JUSTIFICATIFS_OBLIGATOIRES_DEPUIS = new Date("2026-09-22T00:00:00");
export const SOURCE_PIECES_DECAISSEMENT = "FICHE_DECAISSEMENT";

export async function fichesSansJustificatifs(userId: number) {
  const payees = await prisma.ficheDecaissement.findMany({
    where: { demandeurId: userId, statut: "PAYEE", typeDepense: { not: "SALAIRE" }, createdAt: { gte: JUSTIFICATIFS_OBLIGATOIRES_DEPUIS } },
    select: { id: true, reference: true, beneficiaireNom: true, montantDemande: true, montantApprouve: true, typeDepense: true },
    orderBy: { createdAt: "asc" },
  });
  if (payees.length === 0) return [];
  const avecPieces = await prisma.pieceJustificative.findMany({
    where: { sourceType: SOURCE_PIECES_DECAISSEMENT, sourceId: { in: payees.map((f) => f.id) } },
    select: { sourceId: true }, distinct: ["sourceId"],
  });
  const ok = new Set(avecPieces.map((p) => p.sourceId));
  return payees.filter((f) => !ok.has(f.id));
}

export type SortieCaisse = {
  source: "CAISSE" | "CAISSE_PDV";
  operationCaisseId: number | null;
  operationCaissePDVId: number | null;
  reference: string;
  montant: number;
  motif: string;
  mode: "ESPECES" | "VIREMENT" | "CHEQUE" | "MOBILE_MONEY" | null;
  categorie: string | null;
  createdAt: Date;
  operateurId: number;
  pointDeVenteId: number | null;
  beneficiaire: { nom: string; prenom: string; telephone: string | null } | null;
};

export type ResultatSortie = { ok: true; sortie: SortieCaisse } | { ok: false; status: number; error: string };

export async function chargerSortieCaisse(
  ids: { operationCaisseId?: number | null; operationCaissePDVId?: number | null },
  opts: {
    userId: number;
    /** true = l'utilisateur ne peut justifier que ses propres sorties (gestionnaire ordinaire) */
    restreindreOperateur: boolean;
    /** Ex. "FOURNISSEUR" pour les flux de paiement fournisseur */
    categorieRequise?: string;
  },
): Promise<ResultatSortie> {
  const idGrande = ids.operationCaisseId ?? null;
  const idPetite = ids.operationCaissePDVId ?? null;
  if ((idGrande == null) === (idPetite == null)) {
    return {
      ok: false, status: 400,
      error: "Une fiche de décaissement doit être rattachée à une sortie de caisse existante (grande caisse ou petite caisse). Enregistrez d'abord la sortie de caisse.",
    };
  }

  const benef = { select: { nom: true, prenom: true, telephone: true } };
  const fiche = { select: { reference: true } };
  const brut = idGrande != null
    ? await prisma.operationCaisse.findUnique({
        where: { id: idGrande },
        include: { ficheDecaissement: fiche, session: { select: { pointDeVenteId: true } }, beneficiaire: benef },
      })
    : await prisma.operationCaissePDV.findUnique({
        where: { id: idPetite! },
        include: { ficheDecaissement: fiche, caissePDV: { select: { pointDeVenteId: true } }, beneficiaire: benef },
      });

  if (!brut) return { ok: false, status: 404, error: "Sortie de caisse introuvable" };
  if (brut.type !== "DECAISSEMENT") return { ok: false, status: 422, error: "Cette opération de caisse n'est pas une sortie (décaissement)" };
  if (brut.ficheDecaissement) {
    return { ok: false, status: 409, error: `Cette sortie de caisse a déjà une fiche de décaissement (${brut.ficheDecaissement.reference})` };
  }
  if (opts.restreindreOperateur && brut.operateurId !== opts.userId) {
    return { ok: false, status: 403, error: "Vous ne pouvez justifier que vos propres sorties de caisse" };
  }
  if (opts.categorieRequise && brut.categorie !== opts.categorieRequise) {
    return { ok: false, status: 422, error: `Cette sortie de caisse n'est pas de catégorie « ${opts.categorieRequise} »` };
  }

  return {
    ok: true,
    sortie: {
      source: idGrande != null ? "CAISSE" : "CAISSE_PDV",
      operationCaisseId: idGrande,
      operationCaissePDVId: idPetite,
      reference: brut.reference,
      montant: Number(brut.montant),
      motif: brut.motif,
      mode: brut.mode,
      categorie: brut.categorie,
      createdAt: brut.createdAt,
      operateurId: brut.operateurId,
      pointDeVenteId: "session" in brut ? brut.session.pointDeVenteId : brut.caissePDV.pointDeVenteId,
      beneficiaire: brut.beneficiaire,
    },
  };
}
