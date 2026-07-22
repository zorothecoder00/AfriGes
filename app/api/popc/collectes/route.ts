import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPOPCSession } from "@/lib/popc/authPOPC";
import { estEcheanceRemuneration } from "@/lib/formuleCredit";

export const runtime = "nodejs";

/**
 * GET /api/popc/collectes?annee=&mois=&pointDeVenteId=
 * Prévision des 16èmes / 31èmes du mois (CDC §6), lue DIRECTEMENT des échéanciers
 * des crédits (aucune ressaisie). La « collecte de rémunération » est la dernière
 * échéance d'un crédit dont la formule est renseignée (16ème pour Quinzaine,
 * 31ème pour Trentaine). Regroupé par date, avec valeurs prévues et réalisées.
 */
export async function GET(req: Request) {
  const ctx = await getPOPCSession();
  if (!ctx || !ctx.capacites.consulter) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const annee = Number(searchParams.get("annee")) || now.getFullYear();
  const mois = Number(searchParams.get("mois")) || now.getMonth() + 1;
  const pdvParam = searchParams.get("pointDeVenteId");

  // Fenêtre du mois [début, début mois suivant[ en UTC.
  const debut = new Date(Date.UTC(annee, mois - 1, 1));
  const fin = new Date(Date.UTC(annee, mois, 1));

  // Scoping agence : chef d'agence limité à son PDV.
  let pointDeVenteId: number | null = pdvParam ? Number(pdvParam) : null;
  if (ctx.capacites.portee === "agence") {
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: ctx.userId, actif: true }, select: { pointDeVenteId: true },
    });
    pointDeVenteId = aff?.pointDeVenteId ?? null;
  }

  // On récupère les échéances de la période appartenant à un crédit « à formule ».
  // Le filtre final (échéance == dernière du crédit) se fait en JS car Prisma ne
  // compare pas deux colonnes entre elles.
  const echeances = await prisma.echeanceCredit.findMany({
    where: {
      dateEcheance: { gte: debut, lt: fin },
      credit: {
        formule: { not: null },
        ...(pointDeVenteId != null && { pointDeVenteId }),
      },
    },
    select: {
      numeroEcheance: true, dateEcheance: true, montantDu: true, montantPaye: true, statut: true,
      // §6 : agent chargé de la collecte (agent terrain du client) + agence concernée.
      credit: {
        select: {
          id: true, formule: true, dureeJours: true, pointDeVenteId: true,
          client: {
            select: {
              agentTerrainId: true,
              agentTerrain: { select: { id: true, nom: true, prenom: true } },
            },
          },
        },
      },
    },
    orderBy: { dateEcheance: "asc" },
  });

  // Noms des agences concernées (CreditClient.pointDeVenteId n'a pas de relation directe).
  const pdvIds = Array.from(new Set(
    echeances.map((e) => e.credit.pointDeVenteId).filter((v): v is number => v != null),
  ));
  const agences = pdvIds.length
    ? await prisma.pointDeVente.findMany({ where: { id: { in: pdvIds } }, select: { id: true, nom: true } })
    : [];
  const nomAgence = new Map(agences.map((a) => [a.id, a.nom]));

  // Agrégation par date (YYYY-MM-DD) × formule.
  type Bucket = { seiziemes: number; valeur16: number; trentiemes: number; valeur31: number;
                  realises16: number; realises31: number };
  const parDate = new Map<string, Bucket>();
  const vide = (): Bucket => ({ seiziemes: 0, valeur16: 0, trentiemes: 0, valeur31: 0, realises16: 0, realises31: 0 });

  let totalSeiziemes = 0, totalTrentiemes = 0, totalValeur = 0, totalRealises = 0, totalEncaisse = 0;

  // Détail par collecte (§6) : date, type, montant, agent chargé, agence.
  type Detail = {
    creditId: number; date: string; type: "16ème" | "31ème"; montant: number; paye: boolean;
    agentId: number | null; agent: string | null; pointDeVenteId: number | null; agence: string | null;
  };
  const details: Detail[] = [];

  for (const e of echeances) {
    const f = e.credit.formule;
    if (!estEcheanceRemuneration(f, e.numeroEcheance, e.credit.dureeJours)) continue;

    const key = e.dateEcheance.toISOString().slice(0, 10);
    const b = parDate.get(key) ?? vide();
    const du = Number(e.montantDu);
    const paye = Number(e.montantPaye);
    const estPaye = e.statut === "PAYE";

    if (f === "QUINZAINE") {
      b.seiziemes += 1; b.valeur16 += du; if (estPaye) b.realises16 += 1;
      totalSeiziemes += 1;
    } else {
      b.trentiemes += 1; b.valeur31 += du; if (estPaye) b.realises31 += 1;
      totalTrentiemes += 1;
    }
    totalValeur += du;
    totalEncaisse += paye;
    if (estPaye) totalRealises += 1;
    parDate.set(key, b);

    const ag = e.credit.client.agentTerrain;
    const pdvId = e.credit.pointDeVenteId;
    details.push({
      creditId: e.credit.id, date: key, type: f === "QUINZAINE" ? "16ème" : "31ème",
      montant: Number(du.toFixed(2)), paye: estPaye,
      agentId: e.credit.client.agentTerrainId ?? null,
      agent: ag ? `${ag.prenom} ${ag.nom}`.trim() : null,
      pointDeVenteId: pdvId, agence: pdvId != null ? (nomAgence.get(pdvId) ?? null) : null,
    });
  }

  const lignes = Array.from(parDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      nbSeiziemes: b.seiziemes, valeur16: Number(b.valeur16.toFixed(2)), realises16: b.realises16,
      nbTrentiemes: b.trentiemes, valeur31: Number(b.valeur31.toFixed(2)), realises31: b.realises31,
    }));

  return NextResponse.json({
    data: lignes,
    details,
    meta: {
      annee, mois, pointDeVenteId,
      totaux: {
        seiziemes: totalSeiziemes, trentiemes: totalTrentiemes,
        valeurPrevue: Number(totalValeur.toFixed(2)),
        realises: totalRealises, valeurEncaissee: Number(totalEncaisse.toFixed(2)),
      },
    },
  });
}
