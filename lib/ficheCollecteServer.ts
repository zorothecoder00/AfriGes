// lib/ficheCollecteServer.ts
// Données de la Fiche journalière de collecte (lib/ficheCollecteHtml.ts) à partir d'une
// CollecteJournaliere : membres collectés (une ligne par client), récapitulatif de la journée
// et transmission des fonds reprise des bordereaux de remise déposés par l'agent ce jour-là.

import { prisma } from "@/lib/prisma";
import type { FicheCollecteHtmlData } from "@/lib/ficheCollecteHtml";

function bornesJour(date: Date): { debut: Date; fin: Date } {
  const debut = new Date(date);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);
  return { debut, fin };
}

/**
 * Charge la fiche d'une collecte, ou null si introuvable. `acces` décide de la visibilité
 * (l'agent ne voit que ses propres collectes — contrôle fait par l'appelant sur agentId).
 */
export async function chargerFicheCollecte(collecteId: number): Promise<(FicheCollecteHtmlData & { agentId: number; pointDeVenteId: number | null }) | null> {
  const c = await prisma.collecteJournaliere.findUnique({
    where: { id: collecteId },
    include: {
      agent: { select: { id: true, nom: true, prenom: true, gestionnaire: { select: { zone: true } } } },
      validePar: { select: { nom: true, prenom: true } },
      pointDeVente: { select: { nom: true } },
      lignes: {
        orderBy: { id: "asc" },
        include: { client: { select: { id: true, nom: true, prenom: true, codeClient: true, numeroCarteAfrisime: true } } },
      },
    },
  });
  if (!c) return null;

  // 1 — Membres collectés : une ligne par client (pack + crédit… additionnés). « Nbr de jrs » :
  // montant collecté ÷ échéance attendue de la ligne (échéances journalières).
  const parClient = new Map<number, { nom: string; adhesion: string | null; jours: number; montant: number }>();
  for (const l of c.lignes) {
    const montant = Number(l.montantCollecte);
    if (montant <= 0) continue;
    const attendu = Number(l.montantAttendu);
    const jours = attendu > 0 ? Math.round(montant / attendu) : 0;
    const k = l.client.id;
    const cur = parClient.get(k) ?? {
      nom: `${l.client.prenom} ${l.client.nom}`.trim(),
      adhesion: l.client.numeroCarteAfrisime || l.client.codeClient || null,
      jours: 0, montant: 0,
    };
    cur.jours += jours;
    cur.montant += montant;
    parClient.set(k, cur);
  }
  const membres = [...parClient.values()].map((m) => ({ nom: m.nom, adhesion: m.adhesion, jours: m.jours || null, montant: m.montant }));

  // 3 — Transmission des fonds : bordereaux de remise de l'agent pour ce jour (date portée sur
  // le bordereau, à défaut date de création).
  const { debut, fin } = bornesJour(c.dateCollecte);
  const bordereaux = await prisma.bordereauRemiseFonds.findMany({
    where: {
      collecteurId: c.agentId,
      OR: [
        { dateRemise: { gte: debut, lt: fin } },
        { dateRemise: null, createdAt: { gte: debut, lt: fin } },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      tresorier: { select: { nom: true, prenom: true } },
      visaCGTPar: { select: { nom: true, prenom: true } },
    },
  });
  const montantRemis = bordereaux.reduce((s, b) => s + (b.montantConfirmeTresorier != null
    ? Number(b.montantConfirmeTresorier)
    : Number(b.totalBilletageCalcule) + Number(b.cotisationsMobileMoney) + Number(b.montantVirement)), 0);
  const avecTresorier = bordereaux.find((b) => b.tresorier);
  const avecVisa = bordereaux.find((b) => b.visaCGTPar);
  const avecSignature = bordereaux.find((b) => b.signatureCollecteur);
  const nomDe = (p: { nom: string; prenom: string } | null | undefined) => (p ? `${p.prenom} ${p.nom}`.trim() : null);

  return {
    agentId: c.agentId,
    pointDeVenteId: c.pointDeVenteId,
    reference: c.reference,
    date: c.dateCollecte,
    collecteur: nomDe(c.agent),
    zone: c.agent.gestionnaire?.zone ?? c.pointDeVente?.nom ?? null,
    membres,
    montantAttendu: Number(c.montantPrevu),
    montantCollecte: Number(c.montantCollecte),
    transmission: bordereaux.length === 0 ? null : {
      montantRemis,
      especes: bordereaux.some((b) => Number(b.totalBilletageCalcule) > 0),
      depotBancaire: bordereaux.some((b) => Number(b.montantVirement) > 0),
      mobileMoney: bordereaux.some((b) => Number(b.cotisationsMobileMoney) > 0),
      references: bordereaux.map((b) => b.reference),
      signatureCollecteur: avecSignature?.signatureCollecteur ?? null,
      dateSignatureCollecteur: avecSignature?.createdAt ?? null,
    },
    // Trésorier réceptionnaire : comptage du bordereau, à défaut validation de la collecte.
    tresorier: avecTresorier
      ? { nom: nomDe(avecTresorier.tresorier), date: avecTresorier.dateTraitementTresorier, signature: avecTresorier.signatureTresorier }
      : c.validePar ? { nom: nomDe(c.validePar), date: c.dateValidation, signature: null } : null,
    visaCGT: avecVisa ? { nom: nomDe(avecVisa.visaCGTPar), date: avecVisa.dateVisaCGT, signature: avecVisa.signatureVisaCGT } : null,
  };
}
