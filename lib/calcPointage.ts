/**
 * Helpers de calcul automatique pour les pointages.
 * Utilisés dans les routes POST/PATCH de /api/admin/rh/pointages.
 */

interface ConfigRef {
  heureArrivee?:          string | null; // "08:30"
  heureDepart?:           string | null; // "17:30"
  pauseDejeunnerMinutes?: number | null;
  dureeJourneeMinutes?:   number | null;
  toleranceRetardMin?:    number | null;
}

/** Parse "HH:mm" vers un objet Date positionné sur la même journée que `dateRef` */
function parseHHMM(hhmm: string, dateRef: Date): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(dateRef);
  d.setHours(h, m, 0, 0);
  return d;
}

export interface CalcResult {
  tempsTotal:    number | null; // minutes travaillées
  retardMinutes: number | null; // minutes de retard (0 si à l'heure)
  heuresSup:     number | null; // minutes supplémentaires (0 si normal)
  statutAuto:    string;        // statut calculé automatiquement
}

/**
 * Calcule tempsTotal, retardMinutes, heuresSup et le statut à partir
 * des heures de pointage et de la config de référence.
 */
export function calculerPointage(
  heureArrivee: Date | null,
  heureDepart:  Date | null,
  config:       ConfigRef | null,
  dateRef:      Date,
  statutSaisi:  string,
): CalcResult {
  // Si statut explicite (ABSENT, CONGE, MISSION, FERIE) → pas de calcul
  const statutsSpeciaux = ["ABSENT", "CONGE", "MISSION", "FERIE"];
  if (statutsSpeciaux.includes(statutSaisi)) {
    return { tempsTotal: null, retardMinutes: null, heuresSup: null, statutAuto: statutSaisi };
  }

  // ── Temps total ────────────────────────────────────────────
  let tempsTotal: number | null = null;
  if (heureArrivee && heureDepart) {
    const brut   = Math.floor((heureDepart.getTime() - heureArrivee.getTime()) / 60000);
    const pause  = config?.pauseDejeunnerMinutes ?? 0;
    tempsTotal   = Math.max(0, brut - pause);
  }

  // ── Retard ─────────────────────────────────────────────────
  let retardMinutes: number | null = null;
  if (heureArrivee && config?.heureArrivee) {
    const theorique  = parseHHMM(config.heureArrivee, dateRef);
    const tolerance  = config.toleranceRetardMin ?? 0;
    const diffMin    = Math.floor((heureArrivee.getTime() - theorique.getTime()) / 60000);
    retardMinutes    = Math.max(0, diffMin - tolerance);
  }

  // ── Heures sup ─────────────────────────────────────────────
  let heuresSup: number | null = null;
  if (tempsTotal !== null) {
    const dureeTheo = config?.dureeJourneeMinutes ?? (config?.heureArrivee && config?.heureDepart
      ? Math.floor((parseHHMM(config.heureDepart, dateRef).getTime() - parseHHMM(config.heureArrivee, dateRef).getTime()) / 60000) - (config?.pauseDejeunnerMinutes ?? 0)
      : null);
    if (dureeTheo) heuresSup = Math.max(0, tempsTotal - dureeTheo);
  }

  // ── Statut automatique ─────────────────────────────────────
  let statutAuto = statutSaisi;
  if (statutAuto === "PRESENT" && retardMinutes && retardMinutes > 0) {
    statutAuto = "RETARD";
  }
  if (heureArrivee && heureDepart) {
    const totalJournee = config?.dureeJourneeMinutes ?? 480;
    if (tempsTotal !== null && tempsTotal < totalJournee / 2) statutAuto = "DEMI_JOURNEE";
  }

  return { tempsTotal, retardMinutes, heuresSup, statutAuto };
}

/**
 * Récupère la config horaire d'un ProfilRH.
 * Prend la config personnelle si elle existe, sinon la config par défaut.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getConfigHoraire(tx: any, profilRHId: number): Promise<ConfigRef | null> {
  const profil = await tx.profilRH.findUnique({
    where:  { id: profilRHId },
    select: { configHoraire: true },
  });
  if (profil?.configHoraire) return profil.configHoraire;

  const defaut = await tx.configHoraire.findFirst({ where: { estDefaut: true } });
  return defaut ?? null;
}
