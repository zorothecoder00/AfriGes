import { Prisma, TypeMouvementCarriere } from "@prisma/client";

type TX = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export interface MouvementCarriereParams {
  profilRHId: number;
  type: TypeMouvementCarriere;
  ancienneFonction?: string | null;
  nouvelleFonction?: string | null;
  ancienDepartement?: string | null;
  nouveauDepartement?: string | null;
  ancienService?: string | null;
  nouveauService?: string | null;
  ancienManagerId?: number | null;
  nouveauManagerId?: number | null;
  ancienSalaire?: number | null;
  nouveauSalaire?: number | null;
  motif?: string | null;
  modifiePar: number; // User.id
}

/**
 * Crée le HistoriquePoste et mute ProfilRH en conséquence (fonction/département/
 * service/manager). Logique partagée par la saisie directe admin
 * (app/api/admin/rh/carrieres/mouvements) et le workflow de demande
 * (app/api/admin/rh/carrieres/demandes) une fois APPROUVE.
 */
export async function appliquerMouvementCarriere(tx: TX, params: MouvementCarriereParams) {
  const profil = await tx.profilRH.findUnique({ where: { id: params.profilRHId } });
  if (!profil) throw new Error("Collaborateur introuvable");

  const h = await tx.historiquePoste.create({
    data: {
      profilRHId:         params.profilRHId,
      type:               params.type,
      ancienneFonction:   params.ancienneFonction   ?? profil.fonction    ?? null,
      nouvelleFonction:   params.nouvelleFonction   ?? null,
      ancienDepartement:  params.ancienDepartement  ?? profil.departement ?? null,
      nouveauDepartement: params.nouveauDepartement ?? null,
      ancienService:      params.ancienService      ?? profil.service    ?? null,
      nouveauService:     params.nouveauService     ?? null,
      ancienManagerId:    params.ancienManagerId    ?? profil.managerId  ?? null,
      nouveauManagerId:   params.nouveauManagerId    ?? null,
      ancienSalaire:      params.ancienSalaire       ?? null,
      nouveauSalaire:     params.nouveauSalaire      ?? null,
      motif:              params.motif               ?? null,
      modifiePar:         params.modifiePar,
    },
  });

  const updates: Record<string, unknown> = {};
  if (params.nouvelleFonction)   updates.fonction    = params.nouvelleFonction;
  if (params.nouveauDepartement) updates.departement = params.nouveauDepartement;
  if (params.nouveauService)     updates.service     = params.nouveauService;
  if (params.nouveauManagerId)   updates.managerId   = params.nouveauManagerId;
  if (Object.keys(updates).length > 0) {
    await tx.profilRH.update({ where: { id: params.profilRHId }, data: updates });
  }

  return h;
}
