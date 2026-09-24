import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { chargerSortieCaisse, fichesSansJustificatifs, type SortieCaisse } from "@/lib/ficheDecaissementServer";
import { signatureTracee } from "@/lib/signature";

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
      prisma.ficheDecaissement.findMany({
        where, orderBy: { createdAt: "desc" }, include: INCLUDE,
        // Les tracés de signature (images) ne servent qu'au détail et au PDF.
        omit: { signatureDemandeur: true, signatureN1: true, signatureN2: true, signatureExecutant: true, signatureBeneficiaire: true },
      }),
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
 * Demande de décaissement (CDC §3.6, cas nominal) : montantDemande + motif (≥ 10 car.) + type ;
 * le décaissement n'est exécuté qu'après tous les visas requis.
 * Variante « justificatif » : operationCaisseId | operationCaissePDVId référence une sortie de caisse
 * déjà effectuée (montant/mode/opérateur repris, non modifiables) → contrôle N1/N2 a posteriori.
 * Body : { montantDemande?, modePaiement?, operationCaisseId?, operationCaissePDVId?, beneficiaireNom,
 *   beneficiaireContact?, fournisseurId?, motif, typeDepense, bonCommandeFournisseurId?, piecesJustificatives?: string[],
 *   serviceDepartement?, typeDepenseAutre?, signatureDemandeur: "data:image/png;base64,…",
 *   // réception immédiate par le bénéficiaire (fiche justificative d'une sortie déjà faite) :
 *   beneficiaireConfirmationNom?, beneficiaireConfirmationPiece?, signatureBeneficiaire? }
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const userId = parseInt(session.user.id);

    const beneficiaireNomSaisi = String(body.beneficiaireNom || "").trim();
    const typeDepense = body.typeDepense;

    // Deux façons de créer une fiche (CDC §3.6) :
    //  - DEMANDE (cas nominal) : aucune sortie de caisse. Le demandeur saisit objet, type et montant ;
    //    la fiche suit le circuit approbation N1 → N2 (seuil) → exécution par le Caissier/Comptable,
    //    qui effectue la sortie de fonds (et la sortie de caisse en espèces) à ce moment-là.
    //  - JUSTIFICATIF d'une sortie déjà faite : la fiche référence la sortie de caisse (montant,
    //    mode et opérateur repris de la sortie, non modifiables) ; contrôle N1/N2 a posteriori.
    const operationCaisseId = body.operationCaisseId ? Number(body.operationCaisseId) : null;
    const operationCaissePDVId = body.operationCaissePDVId ? Number(body.operationCaissePDVId) : null;
    const liee = operationCaisseId != null || operationCaissePDVId != null;

    // Une nouvelle demande est refusée tant que les justificatifs d'une fiche payée précédente manquent :
    // le demandeur est renvoyé vers cette fiche (l'Admin en est dispensé ; le justificatif d'une sortie
    // de caisse existante n'est pas une nouvelle demande de fonds).
    if (!liee && session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      const manquantes = await fichesSansJustificatifs(userId);
      if (manquantes.length > 0) {
        const f = manquantes[0];
        return NextResponse.json({
          error: `Joignez d'abord les pièces justificatives de la fiche ${f.reference} (${f.beneficiaireNom}) avant d'en créer une nouvelle.`,
          ficheEnAttente: { id: f.id, reference: f.reference },
        }, { status: 409 });
      }
    }

    let op = null as unknown as SortieCaisse; // défini uniquement si `liee`
    if (liee) {
      const voitTout = !!(await getComptableSession());
      const resultat = await chargerSortieCaisse(
        { operationCaisseId, operationCaissePDVId },
        { userId, restreindreOperateur: !voitTout },
      );
      if (!resultat.ok) return NextResponse.json({ error: resultat.error }, { status: resultat.status });
      op = resultat.sortie;
    }
    const pdvOperation = liee ? op.pointDeVenteId : null;

    // Montant / motif : imposés par la sortie de caisse si liée, sinon saisis (motif ≥ 10 caractères).
    const montantDemande = liee ? Number(op.montant) : Number(body.montantDemande);
    if (!liee && (!Number.isFinite(montantDemande) || montantDemande <= 0)) {
      return NextResponse.json({ error: "Montant demandé obligatoire (supérieur à 0)" }, { status: 400 });
    }
    const motifSaisi = String(body.motif || "").trim();
    if (!liee && motifSaisi.length < 10) return NextResponse.json({ error: "Motif : 10 caractères minimum" }, { status: 400 });
    if (liee && motifSaisi && motifSaisi.length < 10) return NextResponse.json({ error: "Motif : 10 caractères minimum" }, { status: 400 });
    const motif = motifSaisi || op.motif;

    let modeSouhaite: "ESPECES" | "MOBILE_MONEY" | "CHEQUE" | "VIREMENT" | null = null;
    if (!liee && body.modePaiement) {
      if (!["ESPECES", "MOBILE_MONEY", "CHEQUE", "VIREMENT"].includes(body.modePaiement)) {
        return NextResponse.json({ error: "Mode de paiement invalide" }, { status: 400 });
      }
      modeSouhaite = body.modePaiement;
    }

    // Bénéficiaire : si la sortie de caisse désigne un membre, son nom et son téléphone sont
    // repris automatiquement (la saisie du formulaire est ignorée) ; sinon saisie manuelle.
    const membre = liee ? op.beneficiaire : null;
    const beneficiaireNom = membre ? `${membre.prenom} ${membre.nom}`.trim() : beneficiaireNomSaisi;
    const beneficiaireContact = membre ? membre.telephone : (body.beneficiaireContact || null);
    if (!beneficiaireNom) return NextResponse.json({ error: "Bénéficiaire obligatoire" }, { status: 400 });
    if (!TYPES_DEPENSE.includes(typeDepense)) return NextResponse.json({ error: `Type de dépense invalide. Valeurs acceptées : ${TYPES_DEPENSE.join(", ")}` }, { status: 400 });

    // Formulaire papier : signature tracée du demandeur obligatoire (sa soumission vaut signature
    // électronique horodatée) ; service/département et précision « Autres » facultatifs.
    const signatureDemandeur = signatureTracee(body.signatureDemandeur);
    if (!signatureDemandeur) return NextResponse.json({ error: "Signature du demandeur obligatoire" }, { status: 400 });
    const serviceDepartement = String(body.serviceDepartement || "").trim().slice(0, 120) || null;
    const typeDepenseAutre = typeDepense === "AUTRES" ? (String(body.typeDepenseAutre || "").trim().slice(0, 120) || null) : null;
    // Fiche justificative (argent déjà sorti) : le bénéficiaire peut confirmer la réception sur place.
    const receptionNom = liee ? String(body.beneficiaireConfirmationNom || "").trim().slice(0, 120) : "";
    const reception = receptionNom ? {
      beneficiaireConfirmationNom: receptionNom,
      beneficiaireConfirmationPiece: String(body.beneficiaireConfirmationPiece || "").trim().slice(0, 120) || null,
      signatureBeneficiaire: signatureTracee(body.signatureBeneficiaire),
      dateConfirmationBeneficiaire: new Date(),
    } : {};

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
              ...(liee
                ? { modePaiement: op.mode ?? null, referencePaiement: op.reference, executeParId: op.operateurId, dateExecution: op.createdAt }
                : { modePaiement: modeSouhaite }),
              operationCaisseId,
              operationCaissePDVId,
              bonCommandeFournisseurId,
              piecesJustificatives,
              serviceDepartement,
              typeDepenseAutre,
              signatureDemandeur,
              ...reception,
            },
            include: INCLUDE,
          });
          await auditLog(tx, userId, "FD_CREEE", "FicheDecaissement", f.id, undefined, getRequestMeta(req));
          await notifyRoles(tx, ["COMPTABLE", "CHEF_COMPTABLE"], {
            titre: liee ? `Fiche de décaissement à contrôler (${reference})` : `Demande de décaissement à approuver (${reference})`,
            message: liee
              ? `${session.user.prenom} ${session.user.nom} a justifié la sortie de caisse ${op.reference} (${montantDemande.toLocaleString("fr-FR")} FCFA pour "${beneficiaireNom}", ${typeDepense}) — contrôle à effectuer.`
              : `${session.user.prenom} ${session.user.nom} demande ${montantDemande.toLocaleString("fr-FR")} FCFA pour "${beneficiaireNom}" (${typeDepense}) — approbation N1 requise.`,
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
