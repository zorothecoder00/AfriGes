import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * Fiche de Décaissement (CDC digitalisation §3.6) — sortie de fonds avec
 * circuit d'approbation à deux niveaux. Le "demandeur" peut être n'importe
 * quel gestionnaire — namespace neutre, ouvert à tous en création.
 */

const TYPES_AVEC_PIECES = ["ACHAT_MARCHANDISES", "PAIEMENT_FOURNISSEUR"];
const TYPES_DEPENSE = ["ACHAT_MARCHANDISES", "FOURNITURES", "PAIEMENT_FOURNISSEUR", "AVANCE_CAISSE", "FRAIS_FONCTIONNEMENT", "TRANSPORT", "AUTRES"];

export const INCLUDE = {
  pointDeVente: { select: { id: true, nom: true, code: true } },
  demandeur: { select: { id: true, nom: true, prenom: true } },
  fournisseur: { select: { id: true, nom: true } },
  bonCommandeFournisseur: { select: { id: true, reference: true, montantTotal: true } },
  approbateurN1: { select: { id: true, nom: true, prenom: true } },
  approbateurN2: { select: { id: true, nom: true, prenom: true } },
  executePar: { select: { id: true, nom: true, prenom: true } },
};

/**
 * GET /api/decaissements
 * Un demandeur ordinaire ne voit que ses propres fiches ; Comptable/Chef
 * Comptable/Admin voient tout. Query: statut?, typeDepense?, demandeurId?
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isComptableOuAdmin = !!(await getComptableSession());

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const typeDepense = searchParams.get("typeDepense");
    const demandeurIdParam = searchParams.get("demandeurId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (typeDepense) where.typeDepense = typeDepense;
    if (!isComptableOuAdmin) {
      where.demandeurId = parseInt(session.user.id);
    } else if (demandeurIdParam) {
      where.demandeurId = Number(demandeurIdParam);
    }

    const [fiches, statsRaw] = await Promise.all([
      prisma.ficheDecaissement.findMany({ where, orderBy: { createdAt: "desc" }, include: INCLUDE }),
      prisma.ficheDecaissement.groupBy({ by: ["statut"], where: isComptableOuAdmin ? {} : { demandeurId: parseInt(session.user.id) }, _count: { id: true } }),
    ]);

    return NextResponse.json({
      data: fiches,
      stats: Object.fromEntries(statsRaw.map((s) => [s.statut, s._count.id])),
    });
  } catch (error) {
    console.error("GET /decaissements:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/decaissements
 * Body : { beneficiaireNom, beneficiaireContact?, fournisseurId?, motif, typeDepense,
 *   montantDemande, bonCommandeFournisseurId?, piecesJustificatives?: string[] }
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const userId = parseInt(session.user.id);

    const beneficiaireNom = String(body.beneficiaireNom || "").trim();
    const motif = String(body.motif || "").trim();
    const typeDepense = body.typeDepense;
    const montantDemande = Number(body.montantDemande);

    if (!beneficiaireNom) return NextResponse.json({ error: "Bénéficiaire obligatoire" }, { status: 400 });
    if (motif.length < 10) return NextResponse.json({ error: "Motif obligatoire (10 caractères minimum)" }, { status: 400 });
    if (!TYPES_DEPENSE.includes(typeDepense)) return NextResponse.json({ error: `Type de dépense invalide. Valeurs acceptées : ${TYPES_DEPENSE.join(", ")}` }, { status: 400 });
    if (!Number.isFinite(montantDemande) || montantDemande <= 0) return NextResponse.json({ error: "Montant demandé invalide" }, { status: 400 });

    const piecesJustificatives = Array.isArray(body.piecesJustificatives) ? body.piecesJustificatives.map(String) : [];
    if (TYPES_AVEC_PIECES.includes(typeDepense) && piecesJustificatives.length === 0) {
      return NextResponse.json({ error: "Au moins une pièce justificative est requise pour ce type de dépense" }, { status: 400 });
    }

    const bonCommandeFournisseurId = body.bonCommandeFournisseurId ? Number(body.bonCommandeFournisseurId) : null;
    if (bonCommandeFournisseurId) {
      const bc = await prisma.bonCommande.findUnique({ where: { id: bonCommandeFournisseurId }, select: { id: true, fournisseurId: true } });
      if (!bc) return NextResponse.json({ error: "Bon de commande fournisseur introuvable" }, { status: 404 });
    }

    const fournisseurId = body.fournisseurId ? Number(body.fournisseurId) : null;

    const aff = await prisma.gestionnaireAffectation.findFirst({ where: { userId, actif: true }, select: { pointDeVenteId: true } });
    const pointDeVenteId = aff?.pointDeVenteId ?? null;

    for (let attempt = 0; attempt < 6; attempt++) {
      const count = await prisma.ficheDecaissement.count();
      const annee = new Date().getFullYear();
      const reference = `FD-${annee}-${String(count + 1 + attempt).padStart(6, "0")}`;
      try {
        const fiche = await prisma.$transaction(async (tx) => {
          const f = await tx.ficheDecaissement.create({
            data: {
              reference,
              statut: "SOUMISE",
              demandeurId: userId,
              pointDeVenteId,
              beneficiaireNom,
              beneficiaireContact: body.beneficiaireContact || null,
              fournisseurId,
              motif,
              typeDepense,
              montantDemande,
              bonCommandeFournisseurId,
              piecesJustificatives,
            },
            include: INCLUDE,
          });
          await auditLog(tx, userId, "FD_CREEE", "FicheDecaissement", f.id, undefined, getRequestMeta(req));
          await notifyRoles(tx, ["COMPTABLE", "CHEF_COMPTABLE"], {
            titre: `Fiche de décaissement soumise (${reference})`,
            message: `${session.user.prenom} ${session.user.nom} demande un décaissement de ${montantDemande.toLocaleString("fr-FR")} FCFA pour "${beneficiaireNom}" (${typeDepense}).`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/decaissements?detail=${f.id}`,
          });
          return f;
        });
        return NextResponse.json({ data: fiche }, { status: 201 });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    return NextResponse.json({ error: "Impossible de générer une référence unique" }, { status: 500 });
  } catch (error) {
    console.error("POST /decaissements:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
