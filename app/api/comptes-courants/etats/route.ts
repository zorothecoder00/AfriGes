import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { chargerParametrageCC } from "@/lib/compteCourant";

/**
 * GET /api/comptes-courants/etats?from&to&granularite
 * États et statistiques détaillés du module (CDC §18) — capacité READ.
 *
 * Retourne, sur la période [from, to] :
 *  - soldeGlobal (encours actuel de tout le portefeuille)
 *  - series : dépôts / retraits / utilisations agrégés par jour|semaine|mois|année
 *  - evolution : solde net cumulé sur la période (évolution des soldes)
 *  - balance : balance par compte (déposé / retiré / utilisé / solde)
 *  - comptesInactifs : comptes sans opération depuis la durée d'inactivité paramétrée
 *  - comptesSuspendus : comptes au statut SUSPENDU
 */

type Granularite = "jour" | "semaine" | "mois" | "annee";

/** Numéro de semaine ISO-8601 + année ISO associée. */
function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

/** Clé + libellé du bucket d'une date selon la granularité. */
function bucket(d: Date, g: Granularite): { key: string; label: string } {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  switch (g) {
    case "jour":    return { key: `${y}-${m}-${day}`, label: `${day}/${m}/${y}` };
    case "semaine": { const { year, week } = isoWeek(d); const w = String(week).padStart(2, "0"); return { key: `${year}-S${w}`, label: `S${w} ${year}` }; }
    case "annee":   return { key: `${y}`, label: `${y}` };
    case "mois":
    default:        return { key: `${y}-${m}`, label: `${m}/${y}` };
  }
}

export async function GET(req: Request) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const g = (["jour", "semaine", "mois", "annee"].includes(searchParams.get("granularite") || "")
    ? searchParams.get("granularite")
    : "mois") as Granularite;

  // Période par défaut : 12 derniers mois.
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date();
  to.setHours(23, 59, 59, 999);
  const from = searchParams.get("from")
    ? new Date(searchParams.get("from")!)
    : new Date(to.getFullYear(), to.getMonth() - 11, 1);
  from.setHours(0, 0, 0, 0);

  const param = await chargerParametrageCC();
  const seuilInactivite = new Date();
  seuilInactivite.setDate(seuilInactivite.getDate() - (param.dureeInactiviteJours || 180));

  const [agg, mouvements, comptes, comptesSuspendus, comptesInactifs] = await Promise.all([
    prisma.compteCourant.aggregate({ _sum: { solde: true }, _count: true }),
    // Mouvements validés sur la période, pour les séries + l'évolution.
    prisma.mouvementCompteCourant.findMany({
      where: { statut: "VALIDE", createdAt: { gte: from, lte: to } },
      select: { createdAt: true, nature: true, montant: true },
      orderBy: { createdAt: "asc" },
    }),
    // Balance par compte.
    prisma.compteCourant.findMany({
      orderBy: { solde: "desc" },
      select: {
        id: true, numeroCompte: true, codeAgence: true, statut: true,
        solde: true, totalDepose: true, totalRetire: true, totalUtilise: true,
        client: { select: { nom: true, prenom: true } },
      },
    }),
    prisma.compteCourant.findMany({
      where: { statut: "SUSPENDU" },
      orderBy: { derniereOperationAt: "asc" },
      select: {
        id: true, numeroCompte: true, statut: true, solde: true, motifBlocage: true,
        derniereOperationAt: true, client: { select: { nom: true, prenom: true } },
      },
    }),
    // Comptes ACTIF sans opération depuis le seuil d'inactivité paramétré.
    prisma.compteCourant.findMany({
      where: {
        statut: "ACTIF",
        OR: [
          { derniereOperationAt: { lt: seuilInactivite } },
          { derniereOperationAt: null, dateOuverture: { lt: seuilInactivite } },
        ],
      },
      orderBy: { derniereOperationAt: "asc" },
      select: {
        id: true, numeroCompte: true, solde: true, dateOuverture: true,
        derniereOperationAt: true, client: { select: { nom: true, prenom: true } },
      },
    }),
  ]);

  const num = (v: unknown) => Number(v ?? 0);

  // ── Séries par période (dépôts / retraits / utilisations / net) ──────────────
  const map = new Map<string, { key: string; label: string; depots: number; retraits: number; utilisations: number; net: number }>();
  for (const m of mouvements) {
    const b = bucket(m.createdAt, g);
    const row = map.get(b.key) ?? { key: b.key, label: b.label, depots: 0, retraits: 0, utilisations: 0, net: 0 };
    const montant = num(m.montant);
    if (m.nature === "DEPOT") row.depots += montant;
    else if (m.nature === "RETRAIT") row.retraits += Math.abs(montant);
    else if (m.nature === "PAIEMENT_CREDIT" || m.nature === "PAIEMENT_COMPTANT") row.utilisations += Math.abs(montant);
    row.net += montant; // signé : dépôts +, sorties −
    map.set(b.key, row);
  }
  const series = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));

  // ── Évolution des soldes : cumul du net sur la période ───────────────────────
  let cumul = 0;
  const evolution = series.map((s) => { cumul += s.net; return { key: s.key, label: s.label, net: s.net, cumul }; });

  // ── Totaux de la période ─────────────────────────────────────────────────────
  const totalDepots       = series.reduce((a, s) => a + s.depots, 0);
  const totalRetraits     = series.reduce((a, s) => a + s.retraits, 0);
  const totalUtilisations = series.reduce((a, s) => a + s.utilisations, 0);

  return NextResponse.json({
    data: {
      periode: { from: from.toISOString(), to: to.toISOString(), granularite: g },
      soldeGlobal: num(agg._sum.solde),
      nbComptes: agg._count,
      totaux: { depots: totalDepots, retraits: totalRetraits, utilisations: totalUtilisations },
      series,
      evolution,
      balance: comptes.map((c) => ({
        id: c.id, numeroCompte: c.numeroCompte, codeAgence: c.codeAgence, statut: c.statut,
        client: `${c.client.prenom} ${c.client.nom}`,
        totalDepose: num(c.totalDepose), totalRetire: num(c.totalRetire),
        totalUtilise: num(c.totalUtilise), solde: num(c.solde),
      })),
      comptesSuspendus: comptesSuspendus.map((c) => ({
        id: c.id, numeroCompte: c.numeroCompte, solde: num(c.solde),
        motif: c.motifBlocage, derniereOperationAt: c.derniereOperationAt,
        client: `${c.client.prenom} ${c.client.nom}`,
      })),
      comptesInactifs: comptesInactifs.map((c) => ({
        id: c.id, numeroCompte: c.numeroCompte, solde: num(c.solde),
        dateOuverture: c.dateOuverture, derniereOperationAt: c.derniereOperationAt,
        client: `${c.client.prenom} ${c.client.nom}`,
      })),
    },
  });
}
