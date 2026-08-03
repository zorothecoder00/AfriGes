// lib/clientNameSearch.ts
//
// Recherche nom/prénom robuste au copier-coller d'un nom complet. Bug corrigé :
// plusieurs routes ne cherchaient que `{ nom: contains } OR { prenom: contains }`
// séparément — ce qui ne matche jamais quand l'utilisateur colle "Prénom Nom"
// (ou "Nom Prénom"), puisque ni le champ nom seul ni le champ prénom seul ne
// contient la chaîne entière. Ce helper ajoute les combinaisons concaténées.
const INSENSITIVE = { mode: "insensitive" as const };

/**
 * Conditions OR à nester dans un `where` Prisma (ex: `{ client: { OR: conditionsNomPrenom(search) } }`
 * ou directement `{ OR: conditionsNomPrenom(search) }` si les champs nom/prenom sont au premier niveau).
 */
export function conditionsNomPrenom(
  search: string,
  champs: { nom: string; prenom: string } = { nom: "nom", prenom: "prenom" },
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = [
    { [champs.nom]: { contains: search, ...INSENSITIVE } },
    { [champs.prenom]: { contains: search, ...INSENSITIVE } },
  ];

  const parts = search.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    const rest = parts.slice(1).join(" ");
    conditions.push({
      AND: [{ [champs.prenom]: { contains: first, ...INSENSITIVE } }, { [champs.nom]: { contains: rest, ...INSENSITIVE } }],
    });
    conditions.push({
      AND: [{ [champs.nom]: { contains: first, ...INSENSITIVE } }, { [champs.prenom]: { contains: rest, ...INSENSITIVE } }],
    });
  }

  return conditions;
}
