import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { sendSMS } from "@/lib/sms";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendEmail, renderEmailLayout } from "@/lib/email";
import { resoudreVariables, type ContexteMessage } from "@/lib/personnalisationMessage";
import { rendererBlocsEmail, type BlocEmail } from "@/lib/emailBuilder";

export class EnvoiCampagneError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const JOUR_MS = 24 * 60 * 60 * 1000;

export type ResultatEnvoiUnClient =
  | { statut: "ENVOYE" }
  | { statut: "ECHEC"; motif: string }
  | { statut: "BLOQUE_CONSENTEMENT" }
  | { statut: "BLOQUE_FREQUENCE" };

/**
 * Envoie un modèle de message à UN client (consentement, frequency capping,
 * personnalisation, envoi via le moteur bas niveau existant, journalisation
 * `EnvoiMessage`). Brique de base réutilisée à la fois par l'envoi de masse à
 * une audience (`envoyerCampagneAAudience`) et par le moteur d'automatisation
 * (CDC §19 — actions ENVOYER_SMS/EMAIL/WHATSAPP) : ne pas dupliquer cette
 * logique ailleurs.
 */
export async function envoyerMessageAUnClient(params: {
  clientId: number;
  canalId: number;
  modeleMessageId: number;
  campagneId?: number | null;
  userId: number;
  /** Variables additionnelles pour {{coupon}}/{{offre}} (actions ATTRIBUER_COUPON/ENVOYER_OFFRE, CDC §19). */
  contexte?: ContexteMessage;
}): Promise<ResultatEnvoiUnClient> {
  const { clientId, canalId, modeleMessageId, campagneId = null, userId, contexte } = params;

  const [client, modele, canal, parametrage] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, telephone: true, email: true, accepteOffres: true, accepteSms: true, accepteEmail: true, accepteWhatsapp: true },
    }),
    prisma.modeleMessage.findUnique({ where: { id: modeleMessageId } }),
    prisma.canalMarketing.findUnique({ where: { id: canalId } }),
    prisma.parametrageMarketing.findUnique({ where: { id: 1 } }),
  ]);

  if (!client) throw new EnvoiCampagneError("Client introuvable", 404);
  if (!modele) throw new EnvoiCampagneError("Modèle de message introuvable", 404);
  if (!canal) throw new EnvoiCampagneError("Canal introuvable", 404);
  if (!["WHATSAPP", "SMS", "EMAIL"].includes(canal.code)) {
    throw new EnvoiCampagneError(`L'envoi automatisé n'est pas encore disponible pour le canal ${canal.code}`, 422);
  }

  const maxParSemaine = parametrage?.maxCommunicationsParSemaine ?? 3;

  const consentementCanal =
    canal.code === "SMS" ? client.accepteSms
    : canal.code === "WHATSAPP" ? client.accepteWhatsapp
    : client.accepteEmail;
  if (!client.accepteOffres || !consentementCanal) {
    return { statut: "BLOQUE_CONSENTEMENT" };
  }

  // Seuls les envois effectivement délivrés au client comptent pour le plafond
  // — un échec fournisseur (provider down, non configuré…) ne doit jamais
  // "consommer" son quota et le priver d'un futur envoi réussi.
  const depuis7Jours = new Date(Date.now() - 7 * JOUR_MS);
  const envoisRecents = await prisma.envoiMessage.count({
    where: { clientId, dateEnvoi: { gte: depuis7Jours }, statut: { in: ["ENVOYE", "LIVRE", "LU", "REPONSE"] } },
  });
  if (envoisRecents >= maxParSemaine) {
    return { statut: "BLOQUE_FREQUENCE" };
  }

  const destinataire = canal.code === "EMAIL" ? client.email : client.telephone;
  if (!destinataire) {
    const motif = canal.code === "EMAIL" ? "Client sans adresse email" : "Client sans numéro de téléphone";
    await prisma.envoiMessage.create({
      data: {
        campagneId, modeleMessageId, canalId, clientId, envoyeParId: userId,
        destinataire: "", contenuRendu: "", statut: "ECHEC", erreur: motif,
      },
    });
    return { statut: "ECHEC", motif };
  }

  let contenuRendu: string;
  let ok: boolean;
  try {
    if (canal.code === "EMAIL") {
      const objet = modele.objet ? await resoudreVariables(modele.objet, clientId, contexte) : modele.nom;
      const emailHtmlBrut = modele.contenuBlocs
        ? await rendererBlocsEmail(modele.contenuBlocs as unknown as BlocEmail[])
        : "";
      const corpsPersonnalise = await resoudreVariables(emailHtmlBrut, clientId, contexte);
      contenuRendu = renderEmailLayout(corpsPersonnalise, objet);
      ok = await sendEmail({ to: destinataire, subject: objet, html: contenuRendu });
    } else {
      contenuRendu = await resoudreVariables(modele.contenuTexte ?? "", clientId, contexte);
      ok = canal.code === "SMS" ? await sendSMS(destinataire, contenuRendu) : await sendWhatsApp(destinataire, contenuRendu);
    }
  } catch (e) {
    contenuRendu = "";
    ok = false;
    console.error("[Marketing] Échec envoi message", { campagneId, clientId, canal: canal.code, error: e });
  }

  await prisma.envoiMessage.create({
    data: {
      campagneId, modeleMessageId, canalId, clientId, envoyeParId: userId,
      destinataire, contenuRendu,
      statut: ok ? "ENVOYE" : "ECHEC",
      erreur: ok ? null : "Envoi refusé par le fournisseur (non configuré ou erreur réseau)",
    },
  });

  return ok ? { statut: "ENVOYE" } : { statut: "ECHEC", motif: "Envoi refusé par le fournisseur" };
}

export interface ResultatEnvoiCampagne {
  total: number;
  envoyes: number;
  echecs: number;
  bloquesConsentement: number;
  bloquesFrequence: number;
}

/**
 * Envoie un modèle de message à toute l'audience d'une campagne (CDC §6/§9
 * "campagne → audience → canaux"). Boucle sur `envoyerMessageAUnClient` (même
 * logique, un seul endroit) pour chaque membre de l'audience.
 */
export async function envoyerCampagneAAudience(params: {
  campagneId: number;
  modeleMessageId: number;
  canalId: number;
  userId: number;
}): Promise<ResultatEnvoiCampagne> {
  const { campagneId, modeleMessageId, canalId, userId } = params;

  const campagne = await prisma.campagne.findUnique({
    where: { id: campagneId },
    select: { id: true, nom: true, audienceId: true },
  });
  if (!campagne) throw new EnvoiCampagneError("Campagne introuvable", 404);
  if (!campagne.audienceId) throw new EnvoiCampagneError("Cette campagne n'a pas d'audience associée", 422);

  const membres = await prisma.audienceMarketingMembre.findMany({
    where: { audienceId: campagne.audienceId },
    select: { clientId: true },
  });

  const resultat: ResultatEnvoiCampagne = { total: membres.length, envoyes: 0, echecs: 0, bloquesConsentement: 0, bloquesFrequence: 0 };

  for (const { clientId } of membres) {
    let issue: ResultatEnvoiUnClient;
    try {
      issue = await envoyerMessageAUnClient({ clientId, canalId, modeleMessageId, campagneId, userId });
    } catch {
      resultat.echecs += 1;
      continue;
    }
    if (issue.statut === "ENVOYE") resultat.envoyes += 1;
    else if (issue.statut === "BLOQUE_CONSENTEMENT") resultat.bloquesConsentement += 1;
    else if (issue.statut === "BLOQUE_FREQUENCE") resultat.bloquesFrequence += 1;
    else resultat.echecs += 1;
  }

  await prisma.$transaction((tx) =>
    auditLog(tx, userId, "ENVOI_CAMPAGNE", "Campagne", campagneId, { modeleMessageId, canalId, ...resultat })
  );

  return resultat;
}
