import { prisma } from "@/lib/prisma";

/**
 * Chargement et validation de la sortie de caisse qu'une fiche de décaissement justifie
 * (règle : la fiche vient APRÈS la sortie de caisse). Partagé par POST /api/decaissements et
 * par les flux fournisseur (paiement d'un bon de commande, règlement dépôt-vente).
 */

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
