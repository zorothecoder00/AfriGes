import { getLogistiqueSession } from "@/lib/authLogistique";
import { getMagasinierSession } from "@/lib/authMagasinier";

/**
 * Tournées de livraison (CDC digitalisation §5.7) — mêmes rôles que le
 * dépôt-vente pour les opérations physiques de stock/livraison
 * (app/api/logistique/depot-vente/depots/[id]/route.ts) : Logistique OU
 * Magasinier, cohérent avec le fait qu'un magasinier peut déjà être
 * enregistré comme livreurId sur un BonLivraison classique.
 */
export async function getSessionLivraison() {
  const logistique = await getLogistiqueSession();
  if (logistique) return logistique;
  return getMagasinierSession();
}
