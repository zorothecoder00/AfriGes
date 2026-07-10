import { prisma } from "@/lib/prisma";
import { VUES_ROLES, vueRoleDefaut, type ModeStock } from "@/lib/vuesCatalogue";

/**
 * Accès base au moteur de vues catalogue (Catalogue §22) — SERVEUR uniquement.
 * Les vues par défaut (lib/vuesCatalogue) servent de graine ; une personnalisation
 * enregistrée (VueCatalogue) prend le dessus. Séparé du module pur client-safe.
 */

export interface VueEffective {
  cle: string;
  nom: string;
  description: string | null;
  champsVisibles: string[];
  modeStock: ModeStock;
  filtres: unknown;
  actif: boolean;
  personnalise: boolean; // true = surcharge enregistrée, false = valeurs par défaut
}

/** Vue effective d'un rôle : personnalisation en base sinon valeurs par défaut. */
export async function vueEffective(cle: string): Promise<VueEffective | null> {
  const defaut = vueRoleDefaut(cle);
  if (!defaut) return null;

  const row = await prisma.vueCatalogue.findUnique({ where: { cle } });
  if (row) {
    return {
      cle, nom: row.nom, description: row.description,
      champsVisibles: row.champsVisibles, modeStock: row.modeStock,
      filtres: row.filtres, actif: row.actif, personnalise: true,
    };
  }
  return {
    cle, nom: defaut.nom, description: defaut.description,
    champsVisibles: defaut.champsDefaut, modeStock: defaut.modeStock,
    filtres: null, actif: true, personnalise: false,
  };
}

/** Toutes les vues effectives (A→J). */
export async function toutesLesVues(): Promise<VueEffective[]> {
  const rows = await prisma.vueCatalogue.findMany();
  const byCle = new Map(rows.map((r) => [r.cle, r]));
  return VUES_ROLES.map((d) => {
    const row = byCle.get(d.cle);
    if (row) {
      return { cle: d.cle, nom: row.nom, description: row.description, champsVisibles: row.champsVisibles, modeStock: row.modeStock as ModeStock, filtres: row.filtres, actif: row.actif, personnalise: true };
    }
    return { cle: d.cle, nom: d.nom, description: d.description, champsVisibles: d.champsDefaut, modeStock: d.modeStock, filtres: null, actif: true, personnalise: false };
  });
}
