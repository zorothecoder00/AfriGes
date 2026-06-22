import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

/**
 * Agrégations serveur pour les onglets gouvernance basés sur les financements
 * (anomalies, investissements, creances).
 *
 * Même motivation que terrain-stats : ces pages chargeaient
 * `/api/admin/ria/financements?limit=50|100` (plafonné à 50) et calculaient
 * leurs totaux / détections d'anomalies / aging côté client sur un jeu tronqué.
 * Résultat : chiffres faux + payload lourd. Ici tout est calculé en base sur
 * l'INTÉGRALITÉ des financements (select minimal), avec une liste de lignes
 * bornée pour les tableaux.
 */

const ROWS_LIMIT = 300;
const DAY = 86_400_000;

type FinRow = {
  id: number;
  reference: string;
  montantFinance: unknown;
  montantRembourse: unknown;
  statut: string;
  dateEcheance: Date | null;
  client: { nom: string; prenom: string; telephone: string | null; ville: string | null; quartier: string | null } | null;
  portefeuille: {
    reference: string;
    profilRIA: { gestionnaire: { member: { nom: string; prenom: string } } };
  };
};

export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const fins = (await prisma.operationFinancementRIA.findMany({
      orderBy: { dateFinancement: "desc" },
      select: {
        id: true,
        reference: true,
        montantFinance: true,
        montantRembourse: true,
        statut: true,
        dateEcheance: true,
        client: { select: { nom: true, prenom: true, telephone: true, ville: true, quartier: true } },
        portefeuille: {
          select: {
            reference: true,
            profilRIA: {
              select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } },
            },
          },
        },
      },
    })) as unknown as FinRow[];

    const now = Date.now();
    const toNum = (v: unknown) => Number(v ?? 0);
    const clientNom = (f: FinRow) => (f.client ? `${f.client.prenom} ${f.client.nom}` : "—");
    const investisseurNom = (f: FinRow) =>
      `${f.portefeuille.profilRIA.gestionnaire.member.prenom} ${f.portefeuille.profilRIA.gestionnaire.member.nom}`;
    const joursRetard = (f: FinRow) =>
      f.dateEcheance ? Math.max(0, Math.floor((now - new Date(f.dateEcheance).getTime()) / DAY)) : 0;

    // ── Totaux globaux ────────────────────────────────────────────────────────
    const total = fins.length;
    let totalFinance = 0;
    let totalRembourse = 0;
    let retardCount = 0;
    for (const f of fins) {
      totalFinance += toNum(f.montantFinance);
      totalRembourse += toNum(f.montantRembourse);
      if (f.statut === "EN_RETARD") retardCount++;
    }

    // ── Anomalies (audit) ─────────────────────────────────────────────────────
    type Anomalie = {
      id: string; type: "EN_RETARD" | "FAIBLE_RECOUVREMENT"; severite: "CRITIQUE" | "HAUTE" | "MOYENNE";
      description: string; client: string; investisseur: string; montant: number; ref: string;
    };
    const anomalies: Anomalie[] = [];
    for (const f of fins) {
      const montant = toNum(f.montantFinance);
      const remb = toNum(f.montantRembourse);
      const pct = montant > 0 ? (remb / montant) * 100 : 100;
      const client = clientNom(f);
      const inv = investisseurNom(f);

      if (f.statut === "EN_RETARD") {
        const jours = joursRetard(f);
        anomalies.push({
          id: `ret-${f.id}`, type: "EN_RETARD",
          severite: jours > 90 ? "CRITIQUE" : jours > 30 ? "HAUTE" : "MOYENNE",
          description: `Financement en retard de ${jours} jour(s)`,
          client, investisseur: inv, montant: montant - remb, ref: f.reference,
        });
      }
      if (pct < 20 && f.statut === "ACTIF" && montant > 0) {
        anomalies.push({
          id: `low-${f.id}`, type: "FAIBLE_RECOUVREMENT", severite: "HAUTE",
          description: `Faible recouvrement : ${pct.toFixed(0)}% seulement remboursé`,
          client, investisseur: inv, montant: montant - remb, ref: f.reference,
        });
      }
    }
    const sevOrder: Record<string, number> = { CRITIQUE: 0, HAUTE: 1, MOYENNE: 2 };
    anomalies.sort((a, b) => sevOrder[a.severite] - sevOrder[b.severite]);
    const anomaliesStats = {
      total: anomalies.length,
      critiques: anomalies.filter((a) => a.severite === "CRITIQUE").length,
      hautes: anomalies.filter((a) => a.severite === "HAUTE").length,
      items: anomalies.slice(0, ROWS_LIMIT),
    };

    // ── Créances (finance) : financements EN_RETARD + aging ───────────────────
    const retardFins = fins.filter((f) => f.statut === "EN_RETARD");
    const tranches = [
      { label: "1–30 jours",   min: 1,   max: 30 },
      { label: "31–90 jours",  min: 31,  max: 90 },
      { label: "91–180 jours", min: 91,  max: 180 },
      { label: ">180 jours",   min: 181, max: Infinity },
    ];
    const aging = tranches.map((t) => ({ label: t.label, count: 0, montant: 0 }));
    let totalCreance = 0;
    let sommeJours = 0;
    const creanceItems = retardFins
      .map((f) => {
        const jours = joursRetard(f);
        const du = toNum(f.montantFinance) - toNum(f.montantRembourse);
        totalCreance += du;
        sommeJours += jours;
        const idx = tranches.findIndex((t) => jours >= t.min && jours <= t.max);
        if (idx >= 0) { aging[idx].count++; aging[idx].montant += du; }
        return {
          id: f.id, reference: f.reference,
          clientNom: f.client?.nom ?? "", clientPrenom: f.client?.prenom ?? "",
          telephone: f.client?.telephone ?? null,
          commune: f.client?.quartier ?? f.client?.ville ?? null,
          du, montant: toNum(f.montantFinance), jours,
          portefeuilleRef: f.portefeuille.reference,
        };
      })
      .sort((a, b) => b.jours - a.jours);
    const creances = {
      count: retardFins.length,
      totalCreance,
      retardMoyen: retardFins.length > 0 ? Math.round(sommeJours / retardFins.length) : 0,
      aging,
      items: creanceItems.slice(0, ROWS_LIMIT),
    };

    // ── Lignes financements (investissements) ─────────────────────────────────
    const rows = fins.slice(0, ROWS_LIMIT).map((f) => {
      const montant = toNum(f.montantFinance);
      const remb = toNum(f.montantRembourse);
      return {
        id: f.id, reference: f.reference,
        clientNom: f.client?.nom ?? "", clientPrenom: f.client?.prenom ?? "",
        portefeuilleRef: f.portefeuille.reference, investisseur: investisseurNom(f),
        montant, rembourse: remb, statut: f.statut,
      };
    });

    return NextResponse.json({
      data: {
        total,
        totalFinance,
        totalRembourse,
        retardCount,
        anomalies: anomaliesStats,
        creances,
        rowsTruncated: total > ROWS_LIMIT,
        rows,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/gouvernance/financements-stats", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
