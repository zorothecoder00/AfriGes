import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { genererCodeClient } from "@/lib/codeClient";
import type { TxClient } from "@/lib/compteCourant";

/**
 * Événements marketing (CDC §42) — événement, lieu, budget, invités,
 * partenaires, inscriptions, présence, leads générés, ventes générées.
 * Rattachement à une Campagne optionnel (un événement peut être autonome).
 */

type EvenementData = {
  campagneId: number | null;
  nom: string;
  lieu: string | null;
  dateDebut: Date;
  dateFin: Date;
  budget: Prisma.Decimal;
  partenaires: string | null;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function validerEvenement(
  body: Record<string, unknown>,
): Promise<{ error: string; status: number } | { data: EvenementData }> {
  const nom = typeof body.nom === "string" ? body.nom.trim() : "";
  if (!nom) return { error: "Le nom de l'événement est requis", status: 400 };

  const campagneId = num(body.campagneId);
  if (campagneId && !(await prisma.campagne.findUnique({ where: { id: campagneId }, select: { id: true } }))) {
    return { error: "Campagne introuvable", status: 404 };
  }

  const dateDebut = body.dateDebut ? new Date(body.dateDebut as string) : null;
  const dateFin = body.dateFin ? new Date(body.dateFin as string) : null;
  if (!dateDebut || isNaN(dateDebut.getTime())) return { error: "Date de début invalide", status: 400 };
  if (!dateFin || isNaN(dateFin.getTime())) return { error: "Date de fin invalide", status: 400 };
  if (dateFin < dateDebut) return { error: "La date de fin doit être postérieure à la date de début", status: 400 };

  return {
    data: {
      campagneId,
      nom,
      lieu: typeof body.lieu === "string" && body.lieu.trim() ? body.lieu.trim() : null,
      dateDebut, dateFin,
      budget: new Prisma.Decimal(num(body.budget) ?? 0),
      partenaires: typeof body.partenaires === "string" && body.partenaires.trim() ? body.partenaires.trim() : null,
    },
  };
}

/**
 * Convertit un participant (invité/inscrit) en Client (CDC §85 : pas de table
 * "leads" dupliquant le CRM — le participant qualifié devient un client
 * normal). Idempotent : renvoie le client déjà lié si déjà converti.
 */
export async function convertirParticipantEnClient(
  tx: TxClient,
  opts: { participantId: number },
) {
  const participant = await tx.participantEvenement.findUnique({
    where: { id: opts.participantId },
    select: { id: true, nom: true, telephone: true, email: true, clientId: true },
  });
  if (!participant) throw new Error("PARTICIPANT_INTROUVABLE");
  if (participant.clientId) return tx.client.findUniqueOrThrow({ where: { id: participant.clientId } });

  const [prenom, ...resteNom] = participant.nom.trim().split(/\s+/);
  const nom = resteNom.join(" ") || prenom;

  const telephone = participant.telephone?.trim() || `EVT-${participant.id}-${Date.now()}`;
  const existant = participant.telephone
    ? await tx.client.findUnique({ where: { telephone: participant.telephone.trim() }, select: { id: true } })
    : null;

  const client = existant
    ? await tx.client.findUniqueOrThrow({ where: { id: existant.id } })
    : await tx.client.create({
        data: {
          nom, prenom, telephone,
          email: participant.email?.trim() || null,
          codeClient: await genererCodeClient(tx),
          soldeActuel: 0,
        },
      });

  await tx.participantEvenement.update({ where: { id: participant.id }, data: { clientId: client.id } });
  return client;
}

const VENTES_EXCLUES = ["ANNULEE", "BROUILLON"];

export interface StatsEvenement {
  nbInvites: number; nbInscrits: number; nbPresents: number; nbAbsents: number;
  leadsGeneres: number; // participants convertis en Client
  nbVentes: number;
  caGenere: number;
}

/** Statistiques d'un événement : présence + leads générés + ventes générées (CDC §42). */
export async function statsEvenement(evenementId: number): Promise<StatsEvenement> {
  const [evenement, parStatut, convertis] = await Promise.all([
    prisma.evenementMarketing.findUniqueOrThrow({ where: { id: evenementId }, select: { dateDebut: true } }),
    prisma.participantEvenement.groupBy({ by: ["statut"], where: { evenementId }, _count: { _all: true } }),
    prisma.participantEvenement.findMany({ where: { evenementId, clientId: { not: null } }, select: { clientId: true } }),
  ]);

  const compte = (s: string) => parStatut.find((p) => p.statut === s)?._count._all ?? 0;
  const clientIds = convertis.map((c) => c.clientId as number);

  let nbVentes = 0, caGenere = 0;
  if (clientIds.length) {
    const agg = await prisma.venteDirecte.aggregate({
      where: { clientId: { in: clientIds }, createdAt: { gte: evenement.dateDebut }, statut: { notIn: VENTES_EXCLUES as never } },
      _count: { _all: true }, _sum: { montantTotal: true },
    });
    nbVentes = agg._count._all;
    caGenere = Number(agg._sum.montantTotal ?? 0);
  }

  return {
    nbInvites: compte("INVITE"), nbInscrits: compte("INSCRIT"), nbPresents: compte("PRESENT"), nbAbsents: compte("ABSENT"),
    leadsGeneres: clientIds.length, nbVentes, caGenere,
  };
}
