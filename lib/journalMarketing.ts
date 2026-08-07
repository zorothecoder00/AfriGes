import { prisma } from "@/lib/prisma";

/**
 * Journal marketing unifié d'un client (CDC §76) : assemble en une seule
 * timeline chronologique les campagnes reçues, messages, ouvertures/réponses,
 * coupons utilisés et achats — sans dupliquer aucune donnée, juste une lecture
 * agrégée de EnvoiMessage/CouponUtilisation/VenteDirecte/ParticipantEvenement/
 * SoumissionFormulaire déjà existants.
 */

export type TypeEvenementJournal =
  | "MESSAGE_ENVOYE" | "MESSAGE_LU" | "MESSAGE_REPONSE"
  | "COUPON_UTILISE" | "ACHAT" | "EVENEMENT_PARTICIPATION" | "FORMULAIRE_SOUMIS";

export interface EvenementJournal {
  type: TypeEvenementJournal;
  date: Date;
  titre: string;
  detail: string | null;
  campagneNom: string | null;
  montant: number | null;
}

export async function journalMarketingClient(clientId: number): Promise<EvenementJournal[]> {
  const [envois, coupons, ventes, participations, soumissions] = await Promise.all([
    prisma.envoiMessage.findMany({
      where: { clientId },
      select: { dateEnvoi: true, dateLecture: true, dateReponse: true, statut: true, canal: { select: { libelle: true } }, campagne: { select: { nom: true } }, modeleMessage: { select: { nom: true } } },
      orderBy: { dateEnvoi: "desc" }, take: 100,
    }),
    prisma.couponUtilisation.findMany({
      where: { clientId },
      select: { dateUtilisation: true, montantRemise: true, coupon: { select: { code: true, nom: true, campagne: { select: { nom: true } } } } },
      orderBy: { dateUtilisation: "desc" }, take: 50,
    }),
    prisma.venteDirecte.findMany({
      where: { clientId, campagneId: { not: null } },
      select: { createdAt: true, reference: true, montantTotal: true, campagne: { select: { nom: true } } },
      orderBy: { createdAt: "desc" }, take: 50,
    }),
    prisma.participantEvenement.findMany({
      where: { clientId },
      select: { createdAt: true, statut: true, evenement: { select: { nom: true, campagne: { select: { nom: true } } } } },
      orderBy: { createdAt: "desc" }, take: 50,
    }),
    prisma.soumissionFormulaire.findMany({
      where: { clientIdCree: clientId },
      select: { createdAt: true, formulaire: { select: { nom: true } }, campagne: { select: { nom: true } } },
      orderBy: { createdAt: "desc" }, take: 50,
    }),
  ]);

  const evenements: EvenementJournal[] = [];

  for (const e of envois) {
    evenements.push({
      type: "MESSAGE_ENVOYE", date: e.dateEnvoi, campagneNom: e.campagne?.nom ?? null, montant: null,
      titre: `Message envoyé — ${e.canal.libelle}`, detail: e.modeleMessage?.nom ?? null,
    });
    if (e.dateLecture) evenements.push({ type: "MESSAGE_LU", date: e.dateLecture, campagneNom: e.campagne?.nom ?? null, montant: null, titre: "Message lu", detail: e.canal.libelle });
    if (e.dateReponse) evenements.push({ type: "MESSAGE_REPONSE", date: e.dateReponse, campagneNom: e.campagne?.nom ?? null, montant: null, titre: "A répondu", detail: e.canal.libelle });
  }
  for (const c of coupons) {
    evenements.push({
      type: "COUPON_UTILISE", date: c.dateUtilisation, campagneNom: c.coupon.campagne?.nom ?? null, montant: Number(c.montantRemise),
      titre: `Coupon utilisé — ${c.coupon.code}`, detail: c.coupon.nom,
    });
  }
  for (const v of ventes) {
    evenements.push({
      type: "ACHAT", date: v.createdAt, campagneNom: v.campagne?.nom ?? null, montant: Number(v.montantTotal),
      titre: `Achat — ${v.reference}`, detail: null,
    });
  }
  for (const p of participations) {
    evenements.push({
      type: "EVENEMENT_PARTICIPATION", date: p.createdAt, campagneNom: p.evenement.campagne?.nom ?? null, montant: null,
      titre: `Événement — ${p.evenement.nom}`, detail: p.statut,
    });
  }
  for (const s of soumissions) {
    evenements.push({
      type: "FORMULAIRE_SOUMIS", date: s.createdAt, campagneNom: s.campagne?.nom ?? null, montant: null,
      titre: `Formulaire soumis — ${s.formulaire.nom}`, detail: null,
    });
  }

  return evenements.sort((a, b) => b.date.getTime() - a.date.getTime());
}
