import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * Bordereau de Remise de Fonds (CDC digitalisation §3.1) — remise d'espèces
 * collectées sur le terrain par un collecteur au trésorier, avec billetage
 * contradictoire et visa Président CGT au-delà du seuil paramétré.
 *
 * Namespace neutre (ni /api/agentTerrain ni /api/comptable) car ce document a
 * deux acteurs symétriques : le collecteur (création) et le trésorier
 * (traitement) — voir lib/parametresDocuments.ts pour le seuil.
 */

const INCLUDE = {
  pointDeVente: { select: { id: true, nom: true, code: true } },
  collecteur: { select: { id: true, nom: true, prenom: true, telephone: true } },
  tresorier: { select: { id: true, nom: true, prenom: true } },
  visaCGTPar: { select: { id: true, nom: true, prenom: true } },
  cloturePar: { select: { id: true, nom: true, prenom: true } },
  lignesBilletage: true,
};

async function getSession() {
  const agent = await getAgentTerrainSession();
  if (agent) return agent;
  return getComptableSession();
}

/**
 * GET /api/tresorerie/bordereaux-remise
 * Un collecteur (non admin/comptable) ne voit que ses propres bordereaux ; le
 * trésorier (Comptable/Chef Comptable) et l'admin voient tout.
 * Query: statut?, collecteurId?
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isTresorierOuAdmin = !!(await getComptableSession());

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const collecteurIdParam = searchParams.get("collecteurId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (!isTresorierOuAdmin) {
      where.collecteurId = parseInt(session.user.id);
    } else if (collecteurIdParam) {
      where.collecteurId = Number(collecteurIdParam);
    }

    const [bordereaux, statsRaw] = await Promise.all([
      prisma.bordereauRemiseFonds.findMany({ where, orderBy: { createdAt: "desc" }, include: INCLUDE }),
      prisma.bordereauRemiseFonds.groupBy({ by: ["statut"], where: isTresorierOuAdmin ? {} : { collecteurId: parseInt(session.user.id) }, _count: { id: true } }),
    ]);

    // Pièces jointes (polymorphes) rattachées en une seule requête.
    const piecesBrutes = bordereaux.length === 0 ? [] : await prisma.pieceJustificative.findMany({
      where: { sourceType: "BORDEREAU_REMISE", sourceId: { in: bordereaux.map((b) => b.id) } },
      select: { id: true, nom: true, url: true, nature: true, sourceId: true },
      orderBy: { createdAt: "asc" },
    });
    const data = bordereaux.map((b) => ({ ...b, pieces: piecesBrutes.filter((p) => p.sourceId === b.id) }));

    return NextResponse.json({
      data,
      stats: Object.fromEntries(statsRaw.map((s) => [s.statut, s._count.id])),
    });
  } catch (error) {
    console.error("GET /tresorerie/bordereaux-remise:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

interface LigneBilletageInput { denomination: number; nombre: number }

/**
 * POST /api/tresorerie/bordereaux-remise
 * Créé par le collecteur (agent terrain). Body :
 * { pieces?: [{nom, url, key, type, taille, nature}], pointDeVenteId?, cotisationsEspeces?, cotisationsMobileMoney?, mobileMoneyReference?,
 *   remboursements?, ventes?, venteCarnet?, fraisLivraison?, montantVirement?, virementReference?,
 *   lignesBilletage: [{denomination, nombre}], motifEcartSoumission?, notes? }
 */
export async function POST(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const userId = parseInt(session.user.id);

    let pointDeVenteId = body.pointDeVenteId ? Number(body.pointDeVenteId) : null;
    const estAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    if (pointDeVenteId && !estAdmin) {
      // Le point de dépôt doit appartenir aux affectations du collecteur (référentiel).
      const autorise = await prisma.gestionnaireAffectation.findFirst({ where: { userId, actif: true, pointDeVenteId }, select: { id: true } });
      if (!autorise) return NextResponse.json({ error: "Point de dépôt non autorisé pour ce collecteur" }, { status: 403 });
    }
    if (!pointDeVenteId) {
      const aff = await prisma.gestionnaireAffectation.findFirst({ where: { userId, actif: true }, select: { pointDeVenteId: true } });
      pointDeVenteId = aff?.pointDeVenteId ?? null;
    }
    if (!pointDeVenteId) {
      return NextResponse.json({ error: "Agence / point de dépôt introuvable (aucune affectation active)" }, { status: 400 });
    }

    const cotisationsEspeces = Math.max(0, Number(body.cotisationsEspeces) || 0);
    const cotisationsMobileMoney = Math.max(0, Number(body.cotisationsMobileMoney) || 0);
    const remboursements = Math.max(0, Number(body.remboursements) || 0);
    const ventes = Math.max(0, Number(body.ventes) || 0);
    const venteCarnet = Math.max(0, Number(body.venteCarnet) || 0);
    const fraisLivraison = Math.max(0, Number(body.fraisLivraison) || 0);
    const montantVirement = Math.max(0, Number(body.montantVirement) || 0);

    if (cotisationsMobileMoney > 0 && !String(body.mobileMoneyReference || "").trim()) {
      return NextResponse.json({ error: "N° de transaction Mobile Money obligatoire" }, { status: 400 });
    }
    if (montantVirement > 0 && !String(body.virementReference || "").trim()) {
      return NextResponse.json({ error: "Référence de virement/dépôt obligatoire" }, { status: 400 });
    }

    // Pièces jointes (déjà téléversées) : avis de virement obligatoire si un virement est déclaré.
    const NATURES_PIECES = ["RECU", "RELEVE_BANCAIRE", "PIECE_CAISSE", "AUTRE"];
    const pieces = (Array.isArray(body.pieces) ? body.pieces : []).filter(
      (p: { url?: string; key?: string; nom?: string; nature?: string }) => p && p.url && p.key && p.nom && NATURES_PIECES.includes(p.nature ?? ""),
    ) as { url: string; key: string; nom: string; type?: string; taille?: number; nature: string }[];
    if (montantVirement > 0 && !pieces.some((p) => p.nature === "RELEVE_BANCAIRE")) {
      return NextResponse.json({ error: "Avis de virement obligatoire en pièce jointe" }, { status: 400 });
    }

    const lignesBilletage = (body.lignesBilletage ?? []) as LigneBilletageInput[];
    for (const l of lignesBilletage) {
      if (!Number.isFinite(l.denomination) || l.denomination <= 0 || !Number.isFinite(l.nombre) || l.nombre < 0) {
        return NextResponse.json({ error: "Ligne de billetage invalide" }, { status: 400 });
      }
    }

    const totalEspecesAttendu = cotisationsEspeces + remboursements + ventes + venteCarnet + fraisLivraison;
    const totalBilletageCalcule = lignesBilletage.reduce((s, l) => s + l.denomination * l.nombre, 0);
    const ecartSoumission = totalBilletageCalcule - totalEspecesAttendu;

    const motifEcartSoumission = String(body.motifEcartSoumission || "").trim() || null;
    if (Math.abs(ecartSoumission) > 0.01 && !motifEcartSoumission) {
      return NextResponse.json(
        { error: `Écart de ${ecartSoumission.toLocaleString("fr-FR")} FCFA entre le billetage et le total espèces attendu : motif obligatoire` },
        { status: 400 }
      );
    }

    for (let attempt = 0; attempt < 6; attempt++) {
      const count = await prisma.bordereauRemiseFonds.count();
      const annee = new Date().getFullYear();
      const reference = `BRF-${annee}-${String(count + 1 + attempt).padStart(6, "0")}`;
      try {
        const bordereau = await prisma.$transaction(async (tx) => {
          const b = await tx.bordereauRemiseFonds.create({
            data: {
              reference,
              pointDeVenteId,
              collecteurId: userId,
              cotisationsEspeces, cotisationsMobileMoney,
              mobileMoneyReference: cotisationsMobileMoney > 0 ? String(body.mobileMoneyReference).trim() : null,
              remboursements, ventes, venteCarnet, fraisLivraison,
              montantVirement,
              virementReference: montantVirement > 0 ? String(body.virementReference).trim() : null,
              totalEspecesAttendu, totalBilletageCalcule, ecartSoumission, motifEcartSoumission,
              notes: body.notes || null,
              lignesBilletage: { create: lignesBilletage.map((l) => ({ denomination: Number(l.denomination), nombre: Number(l.nombre), total: l.denomination * l.nombre })) },
            },
            include: INCLUDE,
          });
          if (pieces.length > 0) {
            const archiverJusquau = new Date();
            archiverJusquau.setFullYear(archiverJusquau.getFullYear() + 10);
            await tx.pieceJustificative.createMany({
              data: pieces.map((p) => ({
                nom: p.nom, url: p.url, uploadthingKey: p.key, type: p.type || "application/octet-stream",
                taille: Number(p.taille) || 0, nature: p.nature as "RECU" | "RELEVE_BANCAIRE" | "PIECE_CAISSE" | "AUTRE",
                sourceType: "BORDEREAU_REMISE", sourceId: b.id, uploadePar: userId, archiverJusquau,
              })),
            });
          }
          await auditLog(tx, userId, "BRF_CREE", "BordereauRemiseFonds", b.id, undefined, getRequestMeta(req));
          await notifyRoles(tx, ["COMPTABLE", "CHEF_COMPTABLE"], {
            titre: `Bordereau de remise de fonds soumis (${reference})`,
            message: `${session.user.prenom} ${session.user.nom} a soumis un bordereau de remise de fonds de ${totalEspecesAttendu.toLocaleString("fr-FR")} FCFA (espèces) depuis "${b.pointDeVente.nom}".`,
            priorite: Math.abs(ecartSoumission) > 0.01 ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/comptables/tresorerie/bordereaux-remise?detail=${b.id}`,
          });
          return b;
        });
        return NextResponse.json({ data: bordereau }, { status: 201 });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    return NextResponse.json({ error: "Impossible de générer une référence unique" }, { status: 500 });
  } catch (error) {
    console.error("POST /tresorerie/bordereaux-remise:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Exporté pour les sous-routes ([id], [id]/pdf) — évite de redéfinir la même logique.
export { getSession, INCLUDE };
