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
const TYPES_DEPENSE = ["ACHAT_MARCHANDISES", "FOURNITURES", "PAIEMENT_FOURNISSEUR", "AVANCE_CAISSE", "FRAIS_FONCTIONNEMENT", "TRANSPORT", "AUTRES", "SALAIRE", "CARBURANT"];

export const INCLUDE = {
  pointDeVente: { select: { id: true, nom: true, code: true } },
  demandeur: { select: { id: true, nom: true, prenom: true } },
  fournisseur: { select: { id: true, nom: true } },
  bonCommandeFournisseur: { select: { id: true, reference: true, montantTotal: true } },
  approbateurN1: { select: { id: true, nom: true, prenom: true } },
  approbateurN2: { select: { id: true, nom: true, prenom: true } },
  executePar: { select: { id: true, nom: true, prenom: true } },
  operationCaisse: { select: { id: true, reference: true, montant: true, categorie: true, createdAt: true } },
  operationCaissePDV: { select: { id: true, reference: true, montant: true, categorie: true, createdAt: true } },
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
 * La fiche vient APRÈS la sortie de caisse : elle doit référencer une sortie existante
 * (grande caisse OU petite caisse RPV, type DECAISSEMENT) qui n'a pas déjà de fiche.
 * Le montant, le mode de paiement, la date et l'opérateur sont repris de la sortie de caisse
 * (non modifiables) ; la fiche sert ensuite de justificatif soumis au contrôle N1/N2.
 * Body : { operationCaisseId | operationCaissePDVId, beneficiaireNom, beneficiaireContact?,
 *   fournisseurId?, motif?, typeDepense, bonCommandeFournisseurId?, piecesJustificatives?: string[] }
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const userId = parseInt(session.user.id);

    const beneficiaireNomSaisi = String(body.beneficiaireNom || "").trim();
    const typeDepense = body.typeDepense;

    // ── Sortie de caisse obligatoire : pas de fiche sans mouvement de caisse ──
    const operationCaisseId = body.operationCaisseId ? Number(body.operationCaisseId) : null;
    const operationCaissePDVId = body.operationCaissePDVId ? Number(body.operationCaissePDVId) : null;
    if ((operationCaisseId == null) === (operationCaissePDVId == null)) {
      return NextResponse.json(
        { error: "Une fiche de décaissement doit être rattachée à une sortie de caisse existante (grande caisse ou petite caisse). Enregistrez d'abord la sortie de caisse." },
        { status: 400 }
      );
    }
    const voitTout = !!(await getComptableSession());
    const op = operationCaisseId != null
      ? await prisma.operationCaisse.findUnique({
          where: { id: operationCaisseId },
          include: {
            ficheDecaissement: { select: { reference: true } }, session: { select: { pointDeVenteId: true } },
            beneficiaire: { select: { nom: true, prenom: true, telephone: true } },
          },
        })
      : await prisma.operationCaissePDV.findUnique({
          where: { id: operationCaissePDVId! },
          include: {
            ficheDecaissement: { select: { reference: true } }, caissePDV: { select: { pointDeVenteId: true } },
            beneficiaire: { select: { nom: true, prenom: true, telephone: true } },
          },
        });
    if (!op) return NextResponse.json({ error: "Sortie de caisse introuvable" }, { status: 404 });
    if (op.type !== "DECAISSEMENT") return NextResponse.json({ error: "Cette opération de caisse n'est pas une sortie (décaissement)" }, { status: 422 });
    if (op.ficheDecaissement) {
      return NextResponse.json({ error: `Cette sortie de caisse a déjà une fiche de décaissement (${op.ficheDecaissement.reference})` }, { status: 409 });
    }
    if (!voitTout && op.operateurId !== userId) {
      return NextResponse.json({ error: "Vous ne pouvez justifier que vos propres sorties de caisse" }, { status: 403 });
    }
    const pdvOperation = "session" in op ? op.session.pointDeVenteId : op.caissePDV.pointDeVenteId;

    // Montant / motif / mode : imposés par la sortie de caisse (la fiche ne peut pas s'en écarter).
    const montantDemande = Number(op.montant);
    const motifSaisi = String(body.motif || "").trim();
    if (motifSaisi && motifSaisi.length < 10) return NextResponse.json({ error: "Motif : 10 caractères minimum" }, { status: 400 });
    const motif = motifSaisi || op.motif;

    // Bénéficiaire : si la sortie de caisse désigne un membre, son nom et son téléphone sont
    // repris automatiquement (la saisie du formulaire est ignorée) ; sinon saisie manuelle.
    const membre = op.beneficiaire;
    const beneficiaireNom = membre ? `${membre.prenom} ${membre.nom}`.trim() : beneficiaireNomSaisi;
    const beneficiaireContact = membre ? membre.telephone : (body.beneficiaireContact || null);
    if (!beneficiaireNom) return NextResponse.json({ error: "Bénéficiaire obligatoire" }, { status: 400 });
    if (!TYPES_DEPENSE.includes(typeDepense)) return NextResponse.json({ error: `Type de dépense invalide. Valeurs acceptées : ${TYPES_DEPENSE.join(", ")}` }, { status: 400 });

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
    const pointDeVenteId = pdvOperation ?? aff?.pointDeVenteId ?? null;

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
              beneficiaireContact,
              fournisseurId,
              motif,
              typeDepense,
              montantDemande,
              modePaiement: op.mode ?? null,
              referencePaiement: op.reference,
              executeParId: op.operateurId,
              dateExecution: op.createdAt,
              operationCaisseId,
              operationCaissePDVId,
              bonCommandeFournisseurId,
              piecesJustificatives,
            },
            include: INCLUDE,
          });
          await auditLog(tx, userId, "FD_CREEE", "FicheDecaissement", f.id, undefined, getRequestMeta(req));
          await notifyRoles(tx, ["COMPTABLE", "CHEF_COMPTABLE"], {
            titre: `Fiche de décaissement à contrôler (${reference})`,
            message: `${session.user.prenom} ${session.user.nom} a justifié la sortie de caisse ${op.reference} (${montantDemande.toLocaleString("fr-FR")} FCFA pour "${beneficiaireNom}", ${typeDepense}) — contrôle à effectuer.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/decaissements?detail=${f.id}`,
          });
          return f;
        });
        return NextResponse.json({ data: fiche }, { status: 201 });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          // Conflit sur le lien vers la sortie de caisse (deux fiches simultanées) ≠ collision de référence.
          if (String(e.meta?.target ?? "").includes("operationCaisse")) {
            return NextResponse.json({ error: "Cette sortie de caisse vient déjà d'être rattachée à une fiche de décaissement" }, { status: 409 });
          }
          continue;
        }
        throw e;
      }
    }
    return NextResponse.json({ error: "Impossible de générer une référence unique" }, { status: 500 });
  } catch (error) {
    console.error("POST /decaissements:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
