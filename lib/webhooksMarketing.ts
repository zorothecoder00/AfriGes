import { prisma } from "@/lib/prisma";
import type { StatutEnvoiMessage } from "@prisma/client";

/**
 * Corrélation des callbacks fournisseur (Twilio/Meta) avec les envois
 * marketing (CDC §24-25 — statuts livré/lu/échec/réponse). Ne fait rien si
 * aucun envoi correspondant n'est trouvé (id inconnu, envoi hors marketing…).
 */
export async function marquerStatutParProviderMessageId(providerMessageId: string, statut: StatutEnvoiMessage): Promise<boolean> {
  const envoi = await prisma.envoiMessage.findFirst({ where: { providerMessageId }, select: { id: true, statut: true } });
  if (!envoi) return false;
  // Ne jamais rétrograder un statut plus avancé (ex: LU -> LIVRE si les callbacks arrivent dans le désordre).
  const ORDRE: StatutEnvoiMessage[] = ["EN_ATTENTE", "ENVOYE", "LIVRE", "LU", "REPONSE"];
  const rangActuel = ORDRE.indexOf(envoi.statut);
  const rangNouveau = ORDRE.indexOf(statut);
  if (statut !== "ECHEC" && rangNouveau <= rangActuel) return true;
  const now = new Date();
  await prisma.envoiMessage.update({
    where: { id: envoi.id },
    data: {
      statut,
      dateLivraison: statut === "LIVRE" ? now : undefined,
      dateLecture: statut === "LU" ? now : undefined,
      dateReponse: statut === "REPONSE" ? now : undefined,
    },
  });
  return true;
}

/** Message entrant sans providerMessageId corrélable (réponse libre) : on marque le dernier envoi au même client/canal comme REPONSE. */
export async function marquerReponseParTelephone(telephoneBrut: string, canalCode: "SMS" | "WHATSAPP"): Promise<boolean> {
  const suffixe = telephoneBrut.replace(/\D/g, "").slice(-8); // comparaison tolérante (préfixe pays variable)
  if (suffixe.length < 6) return false;

  const envoi = await prisma.envoiMessage.findFirst({
    where: { canal: { code: canalCode }, destinataire: { endsWith: suffixe } },
    orderBy: { dateEnvoi: "desc" },
    select: { id: true },
  });
  if (!envoi) return false;
  await prisma.envoiMessage.update({ where: { id: envoi.id }, data: { statut: "REPONSE", dateReponse: new Date() } });
  return true;
}
