// lib/rhDocTemplates/types.ts
// Types partagés du moteur de génération de documents RH.
// Un template = fonction PURE (données collaborateur + champs libres) → HTML.
// Aucune dépendance Prisma ici : le registre reste importable/testable isolément.

/** Données du collaborateur, projetées depuis ProfilRH par la route de génération. */
export interface CollabCtx {
  prenom: string;
  nom: string;
  matricule: string;
  fonction?: string | null;
  departement?: string | null;
  service?: string | null;
  niveauHierarchique?: string | null;
  typeContrat?: string | null;
  dateEmbauche?: Date | null;
  dateFin?: Date | null;
  emailPro?: string | null;
  /** Date de génération (aujourd'hui). */
  today: Date;
}

export type FieldType = "text" | "date" | "number" | "textarea" | "select";

/** Spécification d'un champ libre propre à un type de document (formulaire par type). */
export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  /** Pour type === "select". */
  options?: { value: string; label: string }[];
}

/** Valeurs saisies dans le formulaire par type (toutes optionnelles côté moteur). */
export type DocPayload = Record<string, string | undefined>;

/** Un modèle de document générable. */
export interface RhDocTemplate {
  /** Valeur de l'enum Prisma TypeDocumentRHGenere. */
  type: string;
  /** Libellé lisible (sert au titre du document). */
  label: string;
  /** Suffixe de référence, ex. "ATT" → MAT-2026-0001-ATT-2026. */
  refSuffix: string;
  /** Champs libres à saisir avant génération (peut être vide). */
  fields: FieldSpec[];
  /** Rendu HTML du corps du document (enveloppe société incluse via docShell). */
  render: (ctx: CollabCtx, payload: DocPayload) => string;
}

/** Construit la référence normalisée d'un document. */
export function refCode(matricule: string, suffix: string): string {
  return `${matricule}-${suffix}-${new Date().getFullYear()}`;
}
