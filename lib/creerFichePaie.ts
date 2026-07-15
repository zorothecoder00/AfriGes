/**
 * lib/creerFichePaie.ts — Création d'une fiche de paie (logique métier partagée).
 *
 * Source unique utilisée par les deux routes de création :
 *   - POST /api/admin/rh/paie          (admin)
 *   - POST /api/responsableRH/paie     (responsable RH, scopé PDV)
 *
 * Applique dans UNE transaction, en plus des composants saisis manuellement :
 *   - prime d'ancienneté  (calcAnciennete)      → gain
 *   - commissions         (calcCommission)       → gain
 *   - déduction absences  (calcDeductionsPointage)→ retenue
 *   - remboursements prêts + avances (paieRetenues, décrémente les soldes) → retenues
 * Chaque bloc est activable/désactivable via les flags `auto*` (défaut : activé).
 */  

import { prisma } from "@/lib/prisma";
import { StatutFichePaie, TypeComposantSalaire } from "@prisma/client";
import { appliquerRetenuesAuto } from "@/lib/paieRetenues";
import { calculerCommissionsProfil } from "@/lib/calcCommission";
import { calculerDeductionsAbsence } from "@/lib/calcDeductionsPointage";
import { calculerPrimeAnciennete } from "@/lib/calcAnciennete";

/** Erreur métier portant un status HTTP, à traduire par la route appelante. */
export class FichePaieError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "FichePaieError";
  }
}

interface ComposantInput {
  type: string;
  libelle: string;
  montant: number;
  isRetenue: boolean;
}

export interface CreerFichePaieParams {
  profilRHId: number;
  mois: number;
  annee: number;
  salaireBase: number;
  composants?: ComposantInput[];
  notes?: string | null;
  genereParId: number;
  autoRetenues?: boolean;
  autoCommissions?: boolean;
  autoDeductions?: boolean;
  autoAnciennete?: boolean;
}

/**
 * Crée une fiche de paie en BROUILLON avec ses composants (manuels + automatiques).
 * Lève `FichePaieError` (404 collaborateur introuvable, 409 doublon période).
 */
export async function creerFichePaie(params: CreerFichePaieParams) {
  const { profilRHId, mois, annee, genereParId } = params;
  const salaireBase = Number(params.salaireBase ?? 0);
  const composants  = params.composants ?? [];

  const autoRetenues    = params.autoRetenues    !== false;
  const autoCommissions = params.autoCommissions !== false;
  const autoDeductions  = params.autoDeductions  !== false;
  const autoAnciennete  = params.autoAnciennete  !== false;

  const profil = await prisma.profilRH.findUnique({
    where:   { id: profilRHId },
    include: { gestionnaire: { select: { role: true, memberId: true } } },
  });
  if (!profil) throw new FichePaieError(404, "Collaborateur introuvable");

  // Anti double prélèvement : une seule fiche par (collaborateur, mois, année).
  const dejaCree = await prisma.fichePaie.findUnique({
    where:  { profilRHId_mois_annee: { profilRHId, mois, annee } },
    select: { id: true },
  });
  if (dejaCree) {
    throw new FichePaieError(409, "Une fiche de paie existe déjà pour ce collaborateur sur cette période.");
  }

  const brutManuel        = composants.filter((c) => !c.isRetenue).reduce((s, c) => s + Number(c.montant), salaireBase);
  const retenuesManuelles = composants.filter((c) =>  c.isRetenue).reduce((s, c) => s + Number(c.montant), 0);

  const fiche = await prisma.$transaction(async (tx) => {
    // Retenues automatiques (décrémente les soldes prêts/avances).
    const autoComposants = autoRetenues ? await appliquerRetenuesAuto(tx, profilRHId) : [];

    // Déduction absences (depuis les pointages de la période).
    const deductionComposants = autoDeductions
      ? await calculerDeductionsAbsence(tx, profilRHId, mois, annee, salaireBase)
      : [];

    const retenuesAuto = [...autoComposants, ...deductionComposants].reduce((s, c) => s + c.montant, 0);

    // Commissions automatiques (barème du rôle × activité de la période).
    const commissionComposants = autoCommissions && profil.gestionnaire
      ? await calculerCommissionsProfil(tx, profil.gestionnaire, mois, annee)
      : [];

    // Prime d'ancienneté (% du salaire de base selon les années de service).
    // Non injectée si une PRIME_ANCIENNETE a déjà été saisie manuellement.
    const primeAncienneteComposants =
      autoAnciennete && !composants.some((c) => c.type === "PRIME_ANCIENNETE")
        ? calculerPrimeAnciennete(profil.dateEmbauche, salaireBase, mois, annee)
        : [];

    const gainsAuto =
      commissionComposants.reduce((s, c) => s + c.montant, 0) +
      primeAncienneteComposants.reduce((s, c) => s + c.montant, 0);

    const totalBrut     = brutManuel + gainsAuto;
    const totalRetenues = retenuesManuelles + retenuesAuto;

    const f = await tx.fichePaie.create({
      data: {
        profilRHId,
        mois,
        annee,
        salaireBase,
        totalBrut,
        totalRetenues,
        netAPayer:   totalBrut - totalRetenues,
        notes:       params.notes ?? null,
        genereParId,
        statut:      StatutFichePaie.BROUILLON,
        composants: {
          create: [
            ...composants.map((c) => ({
              type:      c.type as TypeComposantSalaire,
              libelle:   c.libelle,
              montant:   Number(c.montant),
              isRetenue: c.isRetenue ?? false,
            })),
            ...primeAncienneteComposants.map((c) => ({
              type:      c.type as TypeComposantSalaire,
              libelle:   c.libelle,
              montant:   c.montant,
              isRetenue: false,
              ordre:     c.ordre,
            })),
            ...commissionComposants.map((c) => ({
              type:      c.type as TypeComposantSalaire,
              libelle:   c.libelle,
              montant:   c.montant,
              isRetenue: false,
              ordre:     c.ordre,
            })),
            ...[...autoComposants, ...deductionComposants].map((c) => ({
              type:      c.type as TypeComposantSalaire,
              libelle:   c.libelle,
              montant:   c.montant,
              isRetenue: true,
              ordre:     c.ordre,
            })),
          ],
        },
      },
      include: { composants: true },
    });

    await tx.auditLog.create({
      data: {
        userId:   genereParId,
        action:   "CREATE",
        entite:   "FichePaie",
        entiteId: f.id,
        details:  `Fiche paie ${mois}/${annee} créée pour profilRH #${profilRHId}`,
      },
    });

    return f;
  });

  return fiche;
}
