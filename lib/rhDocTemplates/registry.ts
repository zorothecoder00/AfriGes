// lib/rhDocTemplates/registry.ts
// Registre central des templates de documents RH générables.
// Ajouter un nouveau document = créer son template dans un fichier de famille
// (ex. embauche.ts) et l'enregistrer ici — plus aucun switch à maintenir.

import type { RhDocTemplate, FieldSpec } from "./types";
import { templatesDivers } from "./divers";
import { templatesEmbauche } from "./embauche";
import { templatesFinContrat } from "./finContrat";
import { templatesDiscipline } from "./discipline";

const ALL: RhDocTemplate[] = [
  ...templatesDivers,
  ...templatesEmbauche,
  ...templatesFinContrat,
  ...templatesDiscipline,
];

const BY_TYPE = new Map<string, RhDocTemplate>(ALL.map((t) => [t.type, t]));

/** Récupère le template d'un type, ou undefined si non générable automatiquement. */
export function getTemplate(type: string): RhDocTemplate | undefined {
  return BY_TYPE.get(type);
}

/** Métadonnées légères (type + libellé + champs) pour alimenter les formulaires. */
export function listTemplateMeta(): { type: string; label: string; fields: FieldSpec[] }[] {
  return ALL.map((t) => ({ type: t.type, label: t.label, fields: t.fields }));
}
