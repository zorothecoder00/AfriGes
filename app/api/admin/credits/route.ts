import { NextResponse } from "next/server";
import { MemberStatus, NiveauRisque, Prisma, PrioriteNotification, Role, StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

/**
 * ==========================
 * GET /api/admin/credits
 * ==========================
 * Liste paginée des crédits (filtres : statut, clientId, pointDeVenteId, search)
 */
export async function GET(req: Request) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page    = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit   = Math.max(1, Number(searchParams.get("limit") || 20));
    const skip    = (page - 1) * limit;
    const search  = (searchParams.get("search") || "").trim();
    const statut  = searchParams.get("statut") as StatutCredit | null;
    const clientId       = searchParams.get("clientId")       ? Number(searchParams.get("clientId"))       : null;
    const pointDeVenteId = searchParams.get("pointDeVenteId") ? Number(searchParams.get("pointDeVenteId")) : null;

    const where: Prisma.CreditClientWhereInput = {
      ...(statut       && { statut }),
      ...(clientId     && { clientId }),
      ...(pointDeVenteId && { pointDeVenteId }),
      ...(search && {
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { client: { nom:    { contains: search, mode: "insensitive" } } },
          { client: { prenom: { contains: search, mode: "insensitive" } } },
          { client: { telephone: { contains: search, mode: "insensitive" } } },
          { client: { codeClient: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [credits, total] = await Promise.all([
      prisma.creditClient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, reference: true, statut: true,
          montantTotal: true, montantRembourse: true, soldeRestant: true,
          dureeJours: true, dateDebut: true, dateEcheanceFin: true,
          montantJournalier: true, tauxPenalite: true, delaiGraceJours: true,
          fraisDossier: true, assurance: true, autresFrais: true, tauxInteret: true, montantInteret: true,
          garantie: true, observations: true, dateValidation: true,
          garantNom: true, garantTelephone: true, garantAdresse: true, garantTypeGarantie: true, garantValeurEstimee: true,
          createdAt: true, updatedAt: true,
          client: {
            select: {
              id: true, nom: true, prenom: true, codeClient: true, telephone: true, segment: true,
              tags: { select: { tag: { select: { id: true, nom: true, couleur: true } } } },
            },
          },
          creePar:  { select: { id: true, nom: true, prenom: true } },
          validePar: { select: { id: true, nom: true, prenom: true } },
          _count: { select: { lignes: true, echeances: true, remboursements: true } },
        },
      }),
      prisma.creditClient.count({ where }),
    ]);

    return NextResponse.json({
      data: credits,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/credits", error);
    return NextResponse.json({ message: "Erreur lors de la récupération des crédits" }, { status: 500 });
  }
}

/**
 * ==========================
 * POST /api/admin/credits
 * ==========================
 * Créer un nouveau crédit (statut initial : EN_ATTENTE_VALIDATION)
 *
 * Body: {
 *   clientId, pointDeVenteId?,
 *   lignes: [{ produitId?, produitNom, quantite, prixUnitaire, remise? }],
 *   dureeJours, dateDebut,
 *   tauxPenalite?, garantie?, observations?
 * }
 */
export async function POST(req: Request) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      clientId, pointDeVenteId,
      lignes,
      dureeJours, dateDebut,
      tauxPenalite, garantie, observations,
      fraisDossier, assurance, autresFrais, tauxInteret, delaiGraceJours,
      garantNom, garantTelephone, garantAdresse, garantTypeGarantie, garantValeurEstimee,
    } = body;

    // ── Validation de base ────────────────────────────────────────────────────
    if (!clientId || !lignes?.length || !dureeJours || !dateDebut) {
      return NextResponse.json(
        { message: "Champs obligatoires manquants (clientId, lignes, dureeJours, dateDebut)" },
        { status: 400 }
      );
    }
    if (Number(dureeJours) < 1) {
      return NextResponse.json({ message: "La durée doit être d'au moins 1 jour" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // ── Vérifier le client ────────────────────────────────────────────────
      const client = await tx.client.findUnique({
        where: { id: Number(clientId) },
        select: {
          id: true, nom: true, prenom: true,
          etat: true, niveauRisque: true,
          limiteCredit: true, soldeActuel: true,
        },
      });
      if (!client) throw new Error("CLIENT_INTROUVABLE");

      // ── Règles d'éligibilité ──────────────────────────────────────────────
      if (client.etat !== MemberStatus.ACTIF) {
        throw new Error("CLIENT_INACTIF");
      }
      if (client.limiteCredit !== null && client.soldeActuel !== null) {
        if (Number(client.soldeActuel) >= Number(client.limiteCredit)) {
          throw new Error("LIMITE_CREDIT_ATTEINTE");
        }
      }
      if (client.niveauRisque === NiveauRisque.CRITIQUE) {
        const creditEnRetard = await tx.creditClient.findFirst({
          where: { clientId: client.id, statut: StatutCredit.EN_RETARD },
          select: { id: true },
        });
        if (creditEnRetard) throw new Error("CLIENT_CRITIQUE_EN_RETARD");
      }

      // ── Calcul du montant total ───────────────────────────────────────────
      const lignesCalculees = (lignes as {
        produitId?: number;
        produitNom: string;
        quantite: number;
        prixUnitaire: number;
        remise?: number;
      }[]).map((l) => {
        const qte = Number(l.quantite);
        const pu  = Number(l.prixUnitaire);
        const rem = Number(l.remise || 0);
        const montantLigne = Number((pu * qte - rem).toFixed(2));
        return { ...l, qte, pu, rem, montantLigne };
      });

      // Valeur des produits (somme des lignes) + frais/assurance/intérêts = montant total à rembourser.
      const valeurProduits = Number(
        lignesCalculees.reduce((s, l) => s + l.montantLigne, 0).toFixed(2)
      );
      if (valeurProduits <= 0) throw new Error("MONTANT_INVALIDE");

      const fraisDossierN = Math.max(0, Number(fraisDossier ?? 0));
      const assuranceN    = Math.max(0, Number(assurance ?? 0));
      const autresFraisN  = Math.max(0, Number(autresFrais ?? 0));
      const tauxInteretN  = Math.max(0, Number(tauxInteret ?? 0));
      const montantInteret = Number((valeurProduits * tauxInteretN / 100).toFixed(2));
      const montantTotal = Number(
        (valeurProduits + fraisDossierN + assuranceN + autresFraisN + montantInteret).toFixed(2)
      );

      // ── Calcul échéancier (stocké, échéances générées à la validation) ────
      const duree = Number(dureeJours);
      const debut = new Date(dateDebut);
      const montantJournalier = Number((montantTotal / duree).toFixed(2));
      const dateEcheanceFin   = new Date(debut);
      dateEcheanceFin.setDate(dateEcheanceFin.getDate() + duree);

      // ── Référence unique ──────────────────────────────────────────────────
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const count   = await tx.creditClient.count();
      const reference = `CRD-${dateStr}-${String(count + 1).padStart(4, "0")}`;

      // ── Réservation de stock (EN_ATTENTE_VALIDATION) ─────────────────────
      // Incrémenter quantiteReservee pour bloquer le stock en attente de validation
      if (pointDeVenteId) {
        for (const l of lignesCalculees) {
          if (!l.produitId) continue;
          await tx.stockSite.upsert({
            where: {
              produitId_pointDeVenteId: {
                produitId:      Number(l.produitId),
                pointDeVenteId: Number(pointDeVenteId),
              },
            },
            update: { quantiteReservee: { increment: l.qte } },
            create: {
              produitId:       Number(l.produitId),
              pointDeVenteId:  Number(pointDeVenteId),
              quantite:        0,
              quantiteReservee: l.qte,
            },
          });
        }
      }

      // ── Création du crédit ────────────────────────────────────────────────
      const credit = await tx.creditClient.create({
        data: {
          reference,
          clientId: client.id,
          pointDeVenteId: pointDeVenteId ? Number(pointDeVenteId) : null,
          statut: StatutCredit.EN_ATTENTE_VALIDATION,
          montantTotal,
          montantRembourse: 0,
          soldeRestant: montantTotal,
          dureeJours: duree,
          dateDebut: debut,
          dateEcheanceFin,
          montantJournalier,
          fraisDossier:   fraisDossierN,
          assurance:      assuranceN,
          autresFrais:    autresFraisN,
          tauxInteret:    tauxInteretN,
          montantInteret,
          tauxPenalite: tauxPenalite != null ? Number(tauxPenalite) : 0,
          delaiGraceJours: delaiGraceJours != null ? Math.max(0, Number(delaiGraceJours)) : 0,
          garantie: garantie || null,
          garantNom:           garantNom || null,
          garantTelephone:     garantTelephone || null,
          garantAdresse:       garantAdresse || null,
          garantTypeGarantie:  garantTypeGarantie || null,
          garantValeurEstimee: garantValeurEstimee != null ? Math.max(0, Number(garantValeurEstimee)) : 0,
          observations: observations || null,
          creeParId: Number(session.user.id),
          lignes: {
            create: lignesCalculees.map((l) => ({
              produitId:        l.produitId ? Number(l.produitId) : null,
              produitNom:       l.produitNom,
              produitNomSaisi:  l.produitNom,
              quantite:         l.qte,
              prixUnitaire:     l.pu,
              remise:           l.rem,
              montantLigne:     l.montantLigne,
              statut:           "EN_ATTENTE" as const,
              estNouveauProduit: !l.produitId,
              pointDeVenteId:   pointDeVenteId ? Number(pointDeVenteId) : null,
            })),
          },
        },
      });

      // ── Audit log ─────────────────────────────────────────────────────────
      await tx.auditLog.create({
        data: {
          action: "CREATION_CREDIT",
          entite: "CreditClient",
          entiteId: credit.id,
          userId: Number(session.user.id),
        },
      });

      // ── Notifications ──────────────────────────────────────────────────────
      const msgNotif = `Un crédit de ${montantTotal.toLocaleString("fr-FR")} FCFA a été créé pour ${client.prenom} ${client.nom} (${reference}). En attente de validation.`;

      // Admins → page admin
      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });
      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((u) => ({
            userId:   u.id,
            titre:    "Nouveau crédit en attente de validation",
            message:  msgNotif,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/admin/credits`,
          })),
        });
      }

      // Gestionnaires du PDV (RVC, RPV…) → leur page dédiée
      if (pointDeVenteId) {
        const adminIds = new Set(admins.map((u) => u.id));
        const pdvGest = await tx.gestionnaireAffectation.findMany({
          where: { pointDeVenteId: Number(pointDeVenteId), actif: true },
          select: { userId: true },
        });
        const pdvNonAdmins = pdvGest.filter((g) => !adminIds.has(g.userId));
        if (pdvNonAdmins.length > 0) {
          await tx.notification.createMany({
            data: pdvNonAdmins.map((g) => ({
              userId:   g.userId,
              titre:    "Nouveau crédit en attente de validation",
              message:  msgNotif,
              priorite: PrioriteNotification.HAUTE,
              actionUrl: `/dashboard/user/responsablesVenteCredit/credits`,
            })),
          });
        }
      }

      return credit;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/admin/credits", error);
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CLIENT_INTROUVABLE:      ["Client introuvable", 404],
        CLIENT_INACTIF:          ["Ce client n'est pas actif", 422],
        LIMITE_CREDIT_ATTEINTE:  ["La limite de crédit de ce client est atteinte", 422],
        CLIENT_CRITIQUE_EN_RETARD: ["Client en risque CRITIQUE avec un crédit en retard", 422],
        MONTANT_INVALIDE:        ["Le montant total des lignes doit être positif", 400],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ message: msg }, { status });
      }
    }
    return NextResponse.json({ message: "Erreur lors de la création du crédit" }, { status: 500 });
  }
}
