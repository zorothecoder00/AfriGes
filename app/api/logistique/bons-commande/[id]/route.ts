import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getSession } from "../../fournisseurs/route";
import { getRequestMeta } from "@/lib/requestMeta";
import { getSeuilVisaCGTBonCommande } from "@/lib/parametresDocuments";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  fournisseur: { select: { id: true, nom: true, code: true, email: true, telephone: true, adresse: true } },
  pointDeVente: { select: { id: true, nom: true, code: true } },
  demandeCotation: { select: { id: true, reference: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
  approuvePar: { select: { id: true, nom: true, prenom: true } },
  envoyePar: { select: { id: true, nom: true, prenom: true } },
  signePar: { select: { id: true, nom: true, prenom: true } },
  visaCGTPar: { select: { id: true, nom: true, prenom: true } },
  lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } },
  receptions: { select: { id: true, reference: true, statut: true, dateReception: true } },
};

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;
    const bon = await prisma.bonCommande.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!bon) return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 });
    const seuilVisaCGT = await getSeuilVisaCGTBonCommande();
    return NextResponse.json({ data: bon, seuilVisaCGT });
  } catch (error) {
    console.error("GET /logistique/bons-commande/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/bons-commande/[id]
 * - Édition (notes, date livraison, lignes) : uniquement tant que DRAFT.
 * - Workflow : { action: "SOUMETTRE" | "APPROUVER" | "REJETER" | "SIGNER" | "ACCUSER_RECEPTION" | "ANNULER" }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const bonId = Number(id);
    const bon = await prisma.bonCommande.findUnique({ where: { id: bonId } });
    if (!bon) return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 });

    const body = await req.json();
    const userId = parseInt(session.user.id);

    if (body.action) {
      const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
        SOUMETTRE:         { from: ["DRAFT"],               to: "PENDING_APPROVAL" },
        APPROUVER:         { from: ["PENDING_APPROVAL"],    to: "APPROVED" },
        REJETER:           { from: ["PENDING_APPROVAL"],    to: "DRAFT" },
        ACCUSER_RECEPTION: { from: ["SENT"],                to: "ACKNOWLEDGED" },
        ANNULER:           { from: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "ACKNOWLEDGED"], to: "CANCELLED" },
      };

      if (body.action === "ENREGISTRER_PAIEMENT") {
        // CDC §14 — le paiement fournisseur ne s'exécute plus directement ici : il
        // passait auparavant en caisse sans aucun visa (contournait le circuit N1/N2
        // de la Fiche de Décaissement, qui existe pourtant déjà pour ce même type de
        // dépense — PAIEMENT_FOURNISSEUR). On soumet désormais une Fiche de
        // Décaissement liée à ce bon ; montantPaye n'est incrémenté qu'à l'exécution
        // réelle de cette fiche (app/api/decaissements/[id]/route.ts, action EXECUTER).
        const montant = Number(body.montant);
        if (!montant || montant <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
        const soldeDu = Number(bon.montantTotal) - Number(bon.montantPaye);
        if (montant > soldeDu) {
          return NextResponse.json({ error: `Le montant dépasse le solde dû (${soldeDu})` }, { status: 422 });
        }

        // Une seule demande de paiement à la fois par bon : une fiche déjà soumise
        // (non encore payée/rejetée) compterait deux fois sur le même solde dû tant
        // qu'aucune des deux n'est exécutée.
        const ficheEnCours = await prisma.ficheDecaissement.findFirst({
          where: { bonCommandeFournisseurId: bonId, statut: { in: ["SOUMISE", "APPROUVEE"] } },
          select: { id: true, reference: true },
        });
        if (ficheEnCours) {
          return NextResponse.json(
            { error: `Une fiche de décaissement (${ficheEnCours.reference}) est déjà en cours pour ce bon — attendez son paiement ou son rejet avant d'en soumettre une nouvelle` },
            { status: 422 },
          );
        }

        const fournisseur = await prisma.fournisseur.findUnique({ where: { id: bon.fournisseurId }, select: { nom: true } });

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
                  pointDeVenteId: bon.pointDeVenteId,
                  beneficiaireNom: fournisseur?.nom ?? "Fournisseur",
                  fournisseurId: bon.fournisseurId,
                  motif: `Paiement bon de commande ${bon.reference}`,
                  typeDepense: "PAIEMENT_FOURNISSEUR",
                  montantDemande: montant,
                  bonCommandeFournisseurId: bonId,
                  piecesJustificatives: [`Bon de commande ${bon.reference}`],
                },
              });
              await auditLog(tx, userId, "FD_CREEE", "FicheDecaissement", f.id, { bonCommandeFournisseurId: bonId }, getRequestMeta(req));
              await auditLog(tx, userId, "PO_PAIEMENT_SOUMIS", "BonCommande", bonId, { montant, ficheDecaissementId: f.id }, getRequestMeta(req));
              await notifyRoles(tx, ["COMPTABLE", "CHEF_COMPTABLE"], {
                titre: `Fiche de décaissement soumise (${reference})`,
                message: `${session.user.prenom} ${session.user.nom} demande le paiement de ${montant.toLocaleString("fr-FR")} FCFA pour "${f.beneficiaireNom}" (bon de commande ${bon.reference}).`,
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
      }

      if (body.action === "VISER_CGT") {
        // Visa Président CGT / Direction (CDC §3.3) — réservé à ADMIN/SUPER_ADMIN,
        // faute de rôle dédié "Président CGT" dans AfriGes (simplification assumée).
        if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
          return NextResponse.json({ error: "Seule la Direction peut apposer ce visa" }, { status: 403 });
        }
        if (bon.statut !== "APPROVED") {
          return NextResponse.json({ error: "Le bon doit être approuvé avant le visa CGT" }, { status: 422 });
        }
        const updated = await prisma.$transaction(async (tx) => {
          const b = await tx.bonCommande.update({
            where: { id: bonId },
            data: { visaCGTParId: userId, dateVisaCGT: new Date() },
            include: INCLUDE,
          });
          await auditLog(tx, userId, "PO_VISA_CGT", "BonCommande", bonId, undefined, getRequestMeta(req));
          return b;
        });
        return NextResponse.json({ data: updated });
      }

      if (body.action === "SIGNER") {
        if (bon.statut !== "APPROVED" && bon.statut !== "SENT") {
          return NextResponse.json({ error: "Seul un bon approuvé peut être signé" }, { status: 422 });
        }
        const updated = await prisma.$transaction(async (tx) => {
          const b = await tx.bonCommande.update({
            where: { id: bonId },
            data: { signeParId: userId, dateSignature: new Date() },
            include: INCLUDE,
          });
          await auditLog(tx, userId, "PO_SIGNE", "BonCommande", bonId, undefined, getRequestMeta(req));
          return b;
        });
        return NextResponse.json({ data: updated });
      }

      const t = TRANSITIONS[body.action];
      if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!t.from.includes(bon.statut)) {
        return NextResponse.json({ error: `Impossible depuis le statut ${bon.statut}` }, { status: 422 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { statut: t.to };
      if (body.action === "APPROUVER") { data.approuveParId = userId; data.dateApprobation = new Date(); }

      const updated = await prisma.$transaction(async (tx) => {
        const b = await tx.bonCommande.update({ where: { id: bonId }, data, include: INCLUDE });
        await auditLog(tx, userId, `PO_${body.action}`, "BonCommande", bonId, { avant: bon.statut, apres: t.to }, getRequestMeta(req));
        return b;
      });
      return NextResponse.json({ data: updated });
    }

    // ── Édition (DRAFT uniquement) ──────────────────────────────────────────
    if (bon.statut !== "DRAFT") {
      return NextResponse.json({ error: "Seul un bon en brouillon peut être modifié" }, { status: 422 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if ("notes" in body) data.notes = body.notes || null;
    if ("dateLivraisonPrevue" in body) data.dateLivraisonPrevue = body.dateLivraisonPrevue ? new Date(body.dateLivraisonPrevue) : null;

    let updated;
    if (Array.isArray(body.lignes)) {
      for (const l of body.lignes) {
        if (!l.produitId || !l.quantite || l.quantite <= 0 || l.prixUnitaire == null || l.prixUnitaire < 0) {
          return NextResponse.json({ error: "Ligne invalide" }, { status: 400 });
        }
      }
      const montantTotal = body.lignes.reduce((s: number, l: { quantite: number; prixUnitaire: number }) => s + l.quantite * l.prixUnitaire, 0);
      updated = await prisma.$transaction(async (tx) => {
        await tx.ligneBonCommande.deleteMany({ where: { bonCommandeId: bonId } });
        return tx.bonCommande.update({
          where: { id: bonId },
          data: {
            ...data, montantTotal,
            lignes: { create: body.lignes.map((l: { produitId: number; quantite: number; prixUnitaire: number }) => ({
              produitId: Number(l.produitId), quantite: Number(l.quantite), prixUnitaire: Number(l.prixUnitaire),
            })) },
          },
          include: INCLUDE,
        });
      });
    } else {
      if (Object.keys(data).length === 0) return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
      updated = await prisma.bonCommande.update({ where: { id: bonId }, data, include: INCLUDE });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /logistique/bons-commande/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
