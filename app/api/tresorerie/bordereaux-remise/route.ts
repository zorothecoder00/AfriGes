import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { getComptableSession } from "@/lib/authComptable";
import { getRPVSession } from "@/lib/authRPV";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { signatureTracee } from "@/lib/signature";

/**
 * Bordereau de Remise de Fonds (CDC digitalisation §3.1) — remise d'espèces
 * collectées sur le terrain par un collecteur au caissier de son PDV, avec
 * billetage contradictoire ; écriture comptable générée automatiquement dès
 * que le circuit est validé (voir [id]/route.ts).
 *
 * Namespace neutre (ni /api/agentTerrain ni /api/caissier) car ce document a
 * deux acteurs symétriques : le collecteur (création) et le caissier
 * (traitement) — voir lib/parametresDocuments.ts pour le seuil de visa CGT.
 */

const INCLUDE = {
  pointDeVente: { select: { id: true, nom: true, code: true } },
  collecteur: { select: { id: true, nom: true, prenom: true, telephone: true } },
  tresorier: { select: { id: true, nom: true, prenom: true } },
  visaCGTPar: { select: { id: true, nom: true, prenom: true } },
  cloturePar: { select: { id: true, nom: true, prenom: true } },
  lignesBilletage: true,
};

/** Texte libre facultatif, nettoyé et borné (null si vide). */
function texteLibre(v: unknown, max = 120): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t.slice(0, max) : null;
}

async function getSession() {
  const agent = await getAgentTerrainSession();
  if (agent) return agent;
  const caissier = await getCaissierSession();
  if (caissier) return caissier;
  const comptable = await getComptableSession();
  if (comptable) return comptable;
  // RPV (« Président » du visa au même titre que la Direction) : bordereaux de son agence.
  return getRPVSession();
}

/** Le RPV connecté est-il responsable de ce point de vente ? */
async function estRpvDuPdv(userId: number, pointDeVenteId: number): Promise<boolean> {
  const pdv = await prisma.pointDeVente.findUnique({ where: { id: pointDeVenteId }, select: { rpvId: true } });
  return pdv?.rpvId === userId;
}

/**
 * GET /api/tresorerie/bordereaux-remise
 * Un collecteur (non caissier/comptable/admin) ne voit que ses propres
 * bordereaux ; un caissier voit ceux de son PDV (à traiter) ; un RPV ceux de
 * l'agence dont il est responsable (à viser) ; le comptable et l'admin voient tout.
 * Query: statut?, collecteurId?
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const isComptable = !!(await getComptableSession());
    const isCaissier = !isAdmin && !!(await getCaissierSession());
    const isRpv = !isAdmin && !isComptable && !isCaissier && session.user.gestionnaireRole === "RESPONSABLE_POINT_DE_VENTE";

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const collecteurIdParam = searchParams.get("collecteurId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereScope: any = {};
    if (isAdmin || isComptable) {
      if (collecteurIdParam) whereScope.collecteurId = Number(collecteurIdParam);
    } else if (isCaissier) {
      // Un caissier ne traite que les bordereaux déposés à son propre PDV.
      const pdvId = await getCaissierPdvId(parseInt(session.user.id));
      whereScope.pointDeVenteId = pdvId ?? -1;
    } else if (isRpv) {
      whereScope.pointDeVente = { rpvId: parseInt(session.user.id) };
    } else {
      whereScope.collecteurId = parseInt(session.user.id);
    }
    const where = { ...whereScope, ...(statut ? { statut } : {}) };

    const [bordereaux, statsRaw] = await Promise.all([
      prisma.bordereauRemiseFonds.findMany({
        where, orderBy: { createdAt: "desc" }, include: INCLUDE,
        // Les tracés de signature (images) ne servent qu'au détail et au PDF.
        omit: { signatureCollecteur: true, signatureTresorier: true, signatureVisaCGT: true },
      }),
      // Stats par statut TOUJOURS sur le même périmètre (scope), jamais filtrées
      // par `statut` (sinon les badges/onglets ne refléteraient plus qu'une valeur).
      prisma.bordereauRemiseFonds.groupBy({ by: ["statut"], where: whereScope, _count: { id: true } }),
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
 *   lignesBilletage: [{denomination, nombre}], motifEcartSoumission?, notes?,
 *   // formulaire papier : dateRemise?, compteTitulaire?, compteNumero?, compteBanque?, compteGuichet?,
 *   // deposantNom?, deposantPrenom?, deposantZone?, deposantTelephone?, deposantAdresse?, mobileMoneyOperateur?,
 *   // carnetsAnnexes?, fichesPagesDe?, fichesPagesA?, recusNumDe?, recusNumA?,
 *   declarationAcceptee: true, signatureCollecteur: "data:image/png;base64,…" }
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

    // VI — déclaration cochée + signature tracée du collecteur (sur l'appareil de saisie, y compris
    // quand la saisie est faite pour le compte d'un tiers).
    if (body.declarationAcceptee !== true) {
      return NextResponse.json({ error: "La déclaration du collecteur doit être cochée" }, { status: 400 });
    }
    const signatureCollecteur = signatureTracee(body.signatureCollecteur);
    if (!signatureCollecteur) {
      return NextResponse.json({ error: "Signature du collecteur obligatoire" }, { status: 400 });
    }
    const dateRemise = body.dateRemise ? new Date(body.dateRemise) : null;
    if (dateRemise && isNaN(dateRemise.getTime())) {
      return NextResponse.json({ error: "Date du bordereau invalide" }, { status: 400 });
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
              dateRemise,
              compteTitulaire: texteLibre(body.compteTitulaire), compteNumero: texteLibre(body.compteNumero),
              compteBanque: texteLibre(body.compteBanque), compteGuichet: texteLibre(body.compteGuichet),
              deposantNom: texteLibre(body.deposantNom), deposantPrenom: texteLibre(body.deposantPrenom),
              deposantZone: texteLibre(body.deposantZone), deposantTelephone: texteLibre(body.deposantTelephone, 40),
              deposantAdresse: texteLibre(body.deposantAdresse, 200),
              mobileMoneyOperateur: cotisationsMobileMoney > 0 ? texteLibre(body.mobileMoneyOperateur, 60) : null,
              carnetsAnnexes: body.carnetsAnnexes === true,
              fichesPagesDe: texteLibre(body.fichesPagesDe, 20), fichesPagesA: texteLibre(body.fichesPagesA, 20),
              recusNumDe: texteLibre(body.recusNumDe, 30), recusNumA: texteLibre(body.recusNumA, 30),
              declarationAcceptee: true,
              signatureCollecteur,
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
export { getSession, INCLUDE, estRpvDuPdv };
