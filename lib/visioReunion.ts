import { randomBytes } from "crypto";

/**
 * Génère un nom de salle Jitsi unique et non devinable pour une réunion de
 * commission. Le préfixe « afriges-commission- » namespace nos salles sur
 * l'instance publique meet.jit.si afin d'éviter toute collision avec des
 * salles tierces. Server-only (importe `crypto`) — ne pas importer côté client.
 */
export function genererSalleVisio(): string {
  return `afriges-commission-${randomBytes(9).toString("hex")}`;
}
