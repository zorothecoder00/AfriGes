import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getPOPCSession } from "@/lib/popc/authPOPC";
import { calculerObjectifs, type ParametresPOPC } from "@/lib/popc/moteurObjectifs";
import { salairesDepuisPaie } from "@/lib/popc/salairesPaie";
import { auditLog } from "@/lib/notifications";

// Lignes de salaire §3.1 câblées automatiquement depuis la Paie (lecture seule).
// Contrôleurs = saisie manuelle → non listé ici.
const SALAIRES_PAIE = ["salaireAgents", "salaireSuperviseurs", "salaireResponsables"] as const;

export const runtime = "nodejs";

// Champs numériques du paramétrage (charges + commerciaux + hypothèses).
const CHAMPS_DECIMAL = [
  "salaireAgents", "salaireSuperviseurs", "salaireControleurs", "salaireResponsables",
  "carburant", "entretienMotos", "telephone", "internet", "loyer", "eau",
  "electricite", "fournitures", "publicite", "divers",
  "objectifBenefice", "commissionSeizieme", "commissionTrentaine", "prixCarnet",
  "partRevenu16", "partRevenu31", "partRevenuCarnet", "creditsParClient",
] as const;
const CHAMPS_INT = ["joursOuvrables", "nombreAgentsTerrain", "nombreAgences"] as const;

type ParamRecord = Prisma.ParametragePOPCGetPayload<{ include: { objectif: true } }>;

/** Construit les paramètres du moteur depuis un enregistrement Prisma. */
function versParametres(p: ParamRecord): ParametresPOPC {
  const num = (v: Prisma.Decimal | number) => Number(v);
  return {
    salaireAgents: num(p.salaireAgents), salaireSuperviseurs: num(p.salaireSuperviseurs),
    salaireControleurs: num(p.salaireControleurs), salaireResponsables: num(p.salaireResponsables),
    carburant: num(p.carburant), entretienMotos: num(p.entretienMotos), telephone: num(p.telephone),
    internet: num(p.internet), loyer: num(p.loyer), eau: num(p.eau), electricite: num(p.electricite),
    fournitures: num(p.fournitures), publicite: num(p.publicite), divers: num(p.divers),
    objectifBenefice: num(p.objectifBenefice), commissionSeizieme: num(p.commissionSeizieme),
    commissionTrentaine: num(p.commissionTrentaine), prixCarnet: num(p.prixCarnet),
    joursOuvrables: p.joursOuvrables, nombreAgentsTerrain: p.nombreAgentsTerrain,
    nombreAgences: p.nombreAgences, partRevenu16: num(p.partRevenu16),
    partRevenu31: num(p.partRevenu31), partRevenuCarnet: num(p.partRevenuCarnet),
    creditsParClient: num(p.creditsParClient),
  };
}

/** Sérialise l'enregistrement (Decimal → number) pour la réponse JSON. */
function serialiser(p: ParamRecord) {
  const out: Record<string, unknown> = {
    id: p.id, annee: p.annee, mois: p.mois, pointDeVenteId: p.pointDeVenteId,
    statut: p.statut, joursOuvrables: p.joursOuvrables,
    nombreAgentsTerrain: p.nombreAgentsTerrain, nombreAgences: p.nombreAgences,
    creeParId: p.creeParId, valideParId: p.valideParId, dateValidation: p.dateValidation,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  };
  for (const c of CHAMPS_DECIMAL) out[c] = Number(p[c] as Prisma.Decimal);
  const o = p.objectif;
  return {
    ...out,
    objectif: o ? {
      chargesTotales: Number(o.chargesTotales), objectifBenefice: Number(o.objectifBenefice),
      revenuMinimum: Number(o.revenuMinimum), nbSeiziemes: o.nbSeiziemes, nbTrentiemes: o.nbTrentiemes,
      nbCarnets: o.nbCarnets, nbNouveauxCredits: o.nbNouveauxCredits, nbClientsRecruter: o.nbClientsRecruter,
      objectifQuotidien: Number(o.objectifQuotidien), objectifHebdomadaire: Number(o.objectifHebdomadaire),
      objectifMensuel: Number(o.objectifMensuel),
    } : null,
  };
}

/** PDV actif du gestionnaire (pour scoping « agence »). */
async function pdvDeLUtilisateur(userId: number): Promise<number | null> {
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: { userId, actif: true }, select: { pointDeVenteId: true },
  });
  return aff?.pointDeVenteId ?? null;
}

/**
 * GET /api/popc/parametrage?annee=&mois=&pointDeVenteId=
 * Retourne le paramétrage du mois demandé (par défaut : mois courant, global).
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
  let pointDeVenteId = pdvParam ? Number(pdvParam) : 0; // 0 = global

  // Le chef d'agence est scopé à son PDV.
  if (ctx.capacites.portee === "agence") {
    pointDeVenteId = (await pdvDeLUtilisateur(ctx.userId)) ?? 0;
  }

  const param = await prisma.parametragePOPC.findUnique({
    where: { annee_mois_pointDeVenteId: { annee, mois, pointDeVenteId } },
    include: { objectif: true },
  });

  // Salaires câblés depuis la Paie (source unique, lecture seule côté UI).
  const salairesPaie = await salairesDepuisPaie(annee, mois, pointDeVenteId);

  // Overlay des salaires Paie sur l'enregistrement retourné (cohérence des consommateurs).
  const data = param ? serialiser(param) : null;
  if (data) {
    const rec = data as Record<string, unknown>;
    for (const c of SALAIRES_PAIE) rec[c] = salairesPaie[c];
  }

  return NextResponse.json({
    data,
    meta: { annee, mois, pointDeVenteId, salairesPaie },
  });
}

/**
 * POST /api/popc/parametrage
 * Crée ou met à jour le paramétrage du mois puis (re)génère les objectifs (§4).
 * Réservé aux profils disposant de la capacité `modifier`.
 */
export async function POST(req: Request) {
  const ctx = await getPOPCSession();
  if (!ctx || !ctx.capacites.modifier) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const now = new Date();
  const annee = Number(body.annee) || now.getFullYear();
  const mois = Number(body.mois) || now.getMonth() + 1;
  if (mois < 1 || mois > 12) {
    return NextResponse.json({ error: "Mois invalide" }, { status: 400 });
  }

  // 0 = paramétrage global (toutes agences) ; sinon PDV.
  let pointDeVenteId = body.pointDeVenteId != null ? Number(body.pointDeVenteId) : 0;
  if (ctx.capacites.portee === "agence") {
    const pdv = await pdvDeLUtilisateur(ctx.userId);
    if (pdv == null) {
      return NextResponse.json({ error: "Aucune agence associée" }, { status: 400 });
    }
    pointDeVenteId = pdv;
  }

  // Construction des données (valeurs par défaut 0 si non fournies).
  const data: Record<string, number> = {};
  for (const c of CHAMPS_DECIMAL) data[c] = Math.max(0, Number(body[c] ?? 0));
  for (const c of CHAMPS_INT) data[c] = Math.max(0, Math.floor(Number(body[c] ?? 0)));
  // Le prix du carnet par défaut = 300 si non saisi ; garde-fous jours/agents ≥ 1.
  if (!body.prixCarnet) data.prixCarnet = 300;
  if (!data.joursOuvrables) data.joursOuvrables = 26;
  if (!data.nombreAgentsTerrain) data.nombreAgentsTerrain = 1;
  if (!data.nombreAgences) data.nombreAgences = 1;
  if (!data.creditsParClient) data.creditsParClient = 1;

  // Les 3 lignes de salaire câblées viennent EXCLUSIVEMENT de la Paie (aucune
  // ressaisie §1) : on ignore les valeurs du client et on les recalcule serveur.
  // Salaire Contrôleurs reste la valeur saisie (manuel).
  const salairesPaie = await salairesDepuisPaie(annee, mois, pointDeVenteId);
  for (const c of SALAIRES_PAIE) data[c] = salairesPaie[c];

  try {
    const result = await prisma.$transaction(async (tx) => {
      const param = await tx.parametragePOPC.upsert({
        where: { annee_mois_pointDeVenteId: { annee, mois, pointDeVenteId } },
        create: { annee, mois, pointDeVenteId, creeParId: ctx.userId, ...data },
        update: { ...data },
        include: { objectif: true },
      });

      // Génération / mise à jour des objectifs (§4). On ne persiste que les
      // colonnes du modèle (les champs dérivés objectifParAgent/detailRevenu sont
      // recalculés à la volée par le moteur, pas stockés).
      const o = calculerObjectifs(versParametres(param));
      const objectifData = {
        chargesTotales: o.chargesTotales, objectifBenefice: o.objectifBenefice,
        revenuMinimum: o.revenuMinimum, nbSeiziemes: o.nbSeiziemes, nbTrentiemes: o.nbTrentiemes,
        nbCarnets: o.nbCarnets, nbNouveauxCredits: o.nbNouveauxCredits,
        nbClientsRecruter: o.nbClientsRecruter, objectifQuotidien: o.objectifQuotidien,
        objectifHebdomadaire: o.objectifHebdomadaire, objectifMensuel: o.objectifMensuel,
      };
      await tx.objectifPOPC.upsert({
        where: { parametrageId: param.id },
        create: { parametrageId: param.id, ...objectifData },
        update: objectifData,
      });

      await auditLog(tx, ctx.userId, "POPC_PARAMETRAGE_MAJ", "ParametragePOPC", param.id);

      return tx.parametragePOPC.findUnique({
        where: { id: param.id }, include: { objectif: true },
      });
    });

    return NextResponse.json({ data: result ? serialiser(result) : null }, { status: 200 });
  } catch (e) {
    console.error("POST /api/popc/parametrage", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
