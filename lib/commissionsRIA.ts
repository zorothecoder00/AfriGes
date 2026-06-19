import type { TypeCommissionRIA, TypeDossierIC } from "@prisma/client";

/**
 * Source unique de vérité pour la correspondance entre :
 *  - le slug d'URL (route dynamique `[type]`, ex: "operations-terrain")
 *  - l'enum Prisma `TypeCommissionRIA` (ex: "OPERATIONS_TERRAIN")
 *
 * ⚠️ L'enum réel côté base est `AUDIT` (et non `AUDIT_CONTROLE`). Le slug
 * d'URL reste `audit-controle` pour la lisibilité, mais il pointe vers `AUDIT`.
 */
export const COMMISSION_SLUGS = [
  "finance",
  "operations-terrain",
  "audit-controle",
  "optimisation",
] as const;

export type CommissionSlug = (typeof COMMISSION_SLUGS)[number];

export const SLUG_TO_ENUM: Record<CommissionSlug, TypeCommissionRIA> = {
  "finance":            "FINANCE",
  "operations-terrain": "OPERATIONS_TERRAIN",
  "audit-controle":     "AUDIT",
  "optimisation":       "OPTIMISATION",
};

export const ENUM_TO_SLUG: Record<TypeCommissionRIA, CommissionSlug> = {
  FINANCE:            "finance",
  OPERATIONS_TERRAIN: "operations-terrain",
  AUDIT:              "audit-controle",
  OPTIMISATION:       "optimisation",
};

export const COMMISSION_LABELS: Record<TypeCommissionRIA, string> = {
  FINANCE:            "Commission Finance",
  OPERATIONS_TERRAIN: "Commission Opérations Terrain & Approvisionnement",
  AUDIT:              "Commission Audit & Contrôle Interne",
  OPTIMISATION:       "Commission Optimisation des Processus",
};

/** Slug d'URL → enum Prisma (null si slug inconnu). */
export function slugToEnum(slug: string): TypeCommissionRIA | null {
  return SLUG_TO_ENUM[slug as CommissionSlug] ?? null;
}

/** Enum Prisma → slug d'URL. */
export function enumToSlug(type: TypeCommissionRIA): CommissionSlug {
  return ENUM_TO_SLUG[type];
}

/** Libellé lisible à partir de l'enum (fallback sur la valeur brute). */
export function commissionLabel(type: TypeCommissionRIA | string): string {
  return COMMISSION_LABELS[type as TypeCommissionRIA] ?? String(type);
}

// ── Structure officielle d'une commission ────────────────────────────────────
// Chaque commission comporte exactement 3 postes : Président, Rapporteur 1,
// Rapporteur 2. (L'enum Prisma RoleMembreCommissionRIA contient d'anciennes
// valeurs — VICE_PRESIDENT, SECRETAIRE, TRESORIER, MEMBRE — qui ne sont plus
// proposées dans l'interface.)
export const COMMISSION_ROLES = ["PRESIDENT", "RAPPORTEUR_1", "RAPPORTEUR_2"] as const;
export type CommissionRole = (typeof COMMISSION_ROLES)[number];

export const COMMISSION_ROLE_LABELS: Record<string, string> = {
  PRESIDENT:    "Président(e)",
  RAPPORTEUR_1: "Rapporteur 1",
  RAPPORTEUR_2: "Rapporteur 2",
};

/** Pouvoirs associés à chaque poste (cahier des charges). */
export const COMMISSION_ROLE_POWERS: Record<CommissionRole, string[]> = {
  PRESIDENT: [
    "Convocation",
    "Validation des rapports",
    "Validation des recommandations",
    "Validation des résolutions",
    "Attribution des tâches",
    "Signature électronique",
  ],
  RAPPORTEUR_1: [
    "Préparation des dossiers",
    "Analyse",
    "Rédaction des rapports",
    "Préparation des réunions",
  ],
  RAPPORTEUR_2: [
    "Vérification des analyses",
    "Contrôle documentaire",
    "Co-rédaction des rapports",
    "Suivi des actions",
  ],
};

/** Libellé d'un poste (fallback sur la valeur brute pour d'éventuelles données héritées). */
export function roleLabel(role: string): string {
  return COMMISSION_ROLE_LABELS[role] ?? role;
}

// ── Réunions : statuts « exploitables » côté client ───────────────────────────
// Doit rester aligné avec STATUTS_REUNION_EXPLOITABLE de lib/authCommissionRIA.ts
// (constante serveur, non importable en client car elle charge Prisma).
// Une résolution / un plan d'action ne peut être rattaché qu'à une réunion
// EN_COURS ou TENUE ; l'émargement, lui, n'est ouvert que pour EN_COURS.
export const STATUTS_REUNION_EXPLOITABLE = ["EN_COURS", "TENUE"] as const;

/** Vrai si une réunion peut porter une résolution ou un plan d'action. */
export function reunionExploitable(statut: string): boolean {
  return (STATUTS_REUNION_EXPLOITABLE as readonly string[]).includes(statut);
}

// ── Résolutions : cycle de vote officiel (CDC) ────────────────────────────────
// CDC Module Résolutions : En préparation → Soumise → Adoptée | Rejetée → Exécutée.
// (Les anciens statuts EN_ATTENTE / APPROUVEE / EN_APPLICATION / APPLIQUEE sont
//  dépréciés ; remapping : EN_ATTENTE→EN_PREPARATION, APPROUVEE & EN_APPLICATION→ADOPTEE,
//  APPLIQUEE→EXECUTEE.)
export const STATUTS_RESOLUTION = [
  "EN_PREPARATION",
  "SOUMISE",
  "ADOPTEE",
  "REJETEE",
  "EXECUTEE",
] as const;
export type StatutResolution = (typeof STATUTS_RESOLUTION)[number];

export const RESOLUTION_STATUT_META: Record<string, { label: string; color: string }> = {
  EN_PREPARATION: { label: "En préparation", color: "bg-slate-100 text-slate-600" },
  SOUMISE:        { label: "Soumise au vote", color: "bg-blue-100 text-blue-700" },
  ADOPTEE:        { label: "Adoptée",         color: "bg-emerald-100 text-emerald-700" },
  REJETEE:        { label: "Rejetée",         color: "bg-rose-100 text-rose-700" },
  EXECUTEE:       { label: "Exécutée",        color: "bg-teal-100 text-teal-700" },
};

/** Libellé lisible d'un statut de résolution (gère aussi les anciens statuts). */
export function resolutionStatutLabel(statut: string): string {
  if (RESOLUTION_STATUT_META[statut]) return RESOLUTION_STATUT_META[statut].label;
  // Repli pour d'anciennes données non encore migrées
  const legacy: Record<string, string> = {
    EN_ATTENTE: "En préparation", APPROUVEE: "Adoptée",
    EN_APPLICATION: "Adoptée", APPLIQUEE: "Exécutée",
  };
  return legacy[statut] ?? statut;
}

// ── Résolutions : workflow de vote (CDC) ──────────────────────────────────────
// Transitions autorisées et leurs préconditions. S'applique aussi bien au membre
// (Président) qu'à l'admin/supervision : tous suivent l'ordre du vote, seule la
// vérification « est Président » est outrepassée pour l'admin.
export type ResolutionAction = "SOUMETTRE" | "ADOPTER" | "REJETER" | "EXECUTER" | "RETOUR_PREPARATION";

export const RESOLUTION_TRANSITIONS: Record<ResolutionAction, StatutResolution> = {
  SOUMETTRE: "SOUMISE",
  ADOPTER: "ADOPTEE",
  REJETER: "REJETEE",
  EXECUTER: "EXECUTEE",
  RETOUR_PREPARATION: "EN_PREPARATION",
};

export const RESOLUTION_PRECONDITIONS: Record<ResolutionAction, StatutResolution[]> = {
  SOUMETTRE: ["EN_PREPARATION"],
  ADOPTER: ["SOUMISE"],
  REJETER: ["SOUMISE"],
  EXECUTER: ["ADOPTEE"],
  RETOUR_PREPARATION: ["SOUMISE"],
};

// Actions proposables dans l'UI selon le statut courant (libellés inclus).
export const RESOLUTION_ACTIONS_PAR_STATUT: Record<string, { action: ResolutionAction; label: string; danger?: boolean }[]> = {
  EN_PREPARATION: [{ action: "SOUMETTRE", label: "Soumettre au vote" }],
  SOUMISE: [
    { action: "ADOPTER", label: "Adopter" },
    { action: "REJETER", label: "Rejeter", danger: true },
    { action: "RETOUR_PREPARATION", label: "Renvoyer en préparation" },
  ],
  ADOPTEE: [{ action: "EXECUTER", label: "Marquer exécutée" }],
};

// ── Compte rendu : actions définies (structurées) ─────────────────────────────
// CDC : le compte rendu liste les « Actions » ; chacune porte un responsable et une
// échéance et devient une tâche (plan d'action) à la validation.
// Stockées en JSON dans CompteRenduReunionRIA.actionsDefinies (rétro-compatible :
// l'ancien texte libre — une action par ligne — reste lu correctement).
export type ActionCR = {
  titre: string;
  responsableId?: number | null;
  responsableNom?: string | null; // dénormalisé pour l'affichage sans rejointure
  dateEcheance?: string | null;   // ISO court (yyyy-mm-dd)
  priorite?: string | null;       // CRITIQUE | HAUTE | MOYENNE | BASSE
};

/** Parse le champ actionsDefinies : JSON structuré OU ancien texte (une action/ligne). */
export function parseActionsCR(raw?: string | null): ActionCR[] {
  if (!raw) return [];
  const t = raw.trim();
  if (t.startsWith("[")) {
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr)) {
        return arr
          .filter((a) => a && typeof a.titre === "string" && a.titre.trim())
          .map((a) => ({
            titre: String(a.titre).trim(),
            responsableId: a.responsableId ?? null,
            responsableNom: a.responsableNom ?? null,
            dateEcheance: a.dateEcheance ?? null,
            priorite: a.priorite ?? null,
          }));
      }
    } catch {
      /* repli texte ci-dessous */
    }
  }
  return t
    .split("\n")
    .map((l) => l.replace(/^[\s•\-*\d.)]+/, "").trim())
    .filter((l) => l.length > 0)
    .map((titre) => ({ titre }));
}

/** Sérialise des actions structurées vers le champ actionsDefinies (JSON ou ""). */
export function serializeActionsCR(actions: ActionCR[]): string {
  const clean = actions.filter((a) => a.titre.trim());
  return clean.length ? JSON.stringify(clean) : "";
}

// ── Routage inter-commissions imposé par le cahier des charges ────────────────
// Certains types de dossiers ont une trajectoire FIXE entre commissions et ne
// peuvent emprunter aucun autre chemin (Scénario 1 du CDC) :
//  - DEMANDE_FINANCEMENT : la Commission Opérations Terrain détecte le besoin et
//    transmet OBLIGATOIREMENT à la Commission Finance qui analyse et décide.
// Un type absent de cette table reste à routage libre (émettrice = une commission
// du créateur, réceptrice = une autre commission).
export const DOSSIER_ROUTAGE_FIXE: Partial<Record<TypeDossierIC, {
  emettrice: TypeCommissionRIA;
  receptrice: TypeCommissionRIA;
}>> = {
  DEMANDE_FINANCEMENT: { emettrice: "OPERATIONS_TERRAIN", receptrice: "FINANCE" },
};
