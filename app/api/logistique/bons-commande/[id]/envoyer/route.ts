import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../../../fournisseurs/route";
import { htmlToPdf } from "@/lib/pdf";
import { genBonCommandeHtml } from "@/lib/bonCommandeHtml";
import { sendBonCommandeEmail } from "@/lib/email";
import { formatDate } from "@/lib/format";

// Chromium (génération PDF) nécessite le runtime Node.
export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/logistique/bons-commande/[id]/envoyer
 * Génère le PDF et l'envoie par email au fournisseur (CDC §7 étape 7 :
 * "PDF généré automatiquement"). Passe le bon en SENT. Nécessite APPROVED.
 * Si le fournisseur n'a pas d'email, le statut passe quand même à SENT
 * (envoi à considérer comme fait par un autre canal) mais l'email n'est pas
 * envoyé — signalé dans la réponse.
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const bonId = Number(id);
    const bon = await prisma.bonCommande.findUnique({
      where: { id: bonId },
      include: {
        fournisseur: { select: { nom: true, code: true, adresse: true, contact: true, telephone: true, email: true } },
        pointDeVente: { select: { nom: true, code: true } },
        signePar: { select: { nom: true, prenom: true } },
        lignes: { include: { produit: { select: { nom: true } } } },
      },
    });
    if (!bon) return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 });
    if (bon.statut !== "APPROVED") {
      return NextResponse.json({ error: "Le bon doit être approuvé avant d'être envoyé" }, { status: 422 });
    }

    const html = genBonCommandeHtml({
      reference: bon.reference, statut: bon.statut, devise: bon.devise,
      dateCommande: bon.dateCommande, dateLivraisonPrevue: bon.dateLivraisonPrevue, notes: bon.notes,
      fournisseur: bon.fournisseur, pointDeVente: bon.pointDeVente,
      lignes: bon.lignes.map((l) => ({ produitNom: l.produit.nom, quantite: l.quantite, prixUnitaire: Number(l.prixUnitaire) })),
      montantTotal: Number(bon.montantTotal),
      signePar: bon.signePar, dateSignature: bon.dateSignature,
    });
    const pdf = await htmlToPdf(html);

    let emailEnvoye = false;
    if (bon.fournisseur.email) {
      emailEnvoye = await sendBonCommandeEmail({
        to: bon.fournisseur.email,
        fournisseurNom: bon.fournisseur.nom,
        reference: bon.reference,
        montantTotal: `${Number(bon.montantTotal).toLocaleString("fr-FR")} ${bon.devise ?? "XOF"}`,
        dateLivraisonPrevue: bon.dateLivraisonPrevue ? formatDate(bon.dateLivraisonPrevue) : null,
        pdf,
      });
    }

    const userId = parseInt(session.user.id);
    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.bonCommande.update({
        where: { id: bonId },
        data: { statut: "SENT", envoyeParId: userId, dateEnvoi: new Date() },
        include: {
          fournisseur: { select: { id: true, nom: true, code: true, email: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
          lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } },
        },
      });
      await auditLog(tx, userId, "PO_ENVOYE", "BonCommande", bonId, { emailEnvoye });
      return b;
    });

    return NextResponse.json({ data: updated, emailEnvoye });
  } catch (error) {
    console.error("POST /logistique/bons-commande/[id]/envoyer:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
