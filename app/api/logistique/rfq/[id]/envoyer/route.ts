import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../../../fournisseurs/route";
import { sendRfqEmail } from "@/lib/email";
import { formatDate } from "@/lib/format";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/logistique/rfq/[id]/envoyer
 * Envoie la consultation aux fournisseurs sélectionnés (email automatique si
 * une adresse est renseignée — CDC §7 étape 5) et passe la RFQ en ENVOYEE.
 * Les fournisseurs sans email restent à consulter par un autre canal (téléphone…),
 * leur cotation se saisit ensuite de la même façon via /reponses/[reponseId].
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const demandeId = Number(id);
    const demande = await prisma.demandeCotation.findUnique({
      where: { id: demandeId },
      include: {
        produit: { select: { nom: true } },
        reponses: { include: { fournisseur: { select: { id: true, nom: true, email: true } } } },
      },
    });
    if (!demande) return NextResponse.json({ error: "Demande de cotation introuvable" }, { status: 404 });
    if (demande.statut !== "BROUILLON") {
      return NextResponse.json({ error: "Cette RFQ a déjà été envoyée" }, { status: 422 });
    }
    if (demande.reponses.length === 0) {
      return NextResponse.json({ error: "Aucun fournisseur à consulter" }, { status: 422 });
    }

    const now = new Date();
    const dateLimiteFmt = demande.dateLimiteReponse ? formatDate(demande.dateLimiteReponse) : null;

    let emailsEnvoyes = 0;
    for (const r of demande.reponses) {
      if (!r.fournisseur.email) continue;
      const ok = await sendRfqEmail({
        to: r.fournisseur.email,
        fournisseurNom: r.fournisseur.nom,
        reference: demande.reference,
        produitNom: demande.produit.nom,
        quantite: demande.quantite,
        dateLimiteReponse: dateLimiteFmt,
        notes: demande.notes,
      });
      if (ok) {
        await prisma.reponseRFQ.update({ where: { id: r.id }, data: { emailEnvoyeA: now } });
        emailsEnvoyes++;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.demandeCotation.update({
        where: { id: demandeId },
        data: { statut: "ENVOYEE" },
        include: {
          produit: { select: { id: true, nom: true, codeProduit: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
          reponses: { include: { fournisseur: { select: { id: true, nom: true, code: true, email: true, noteGlobale: true } } } },
        },
      });
      await auditLog(tx, parseInt(session.user.id), "RFQ_ENVOYEE", "DemandeCotation", demandeId,
        { fournisseursConsultes: demande.reponses.length, emailsEnvoyes });
      return d;
    });

    return NextResponse.json({ data: updated, emailsEnvoyes, totalFournisseurs: demande.reponses.length });
  } catch (error) {
    console.error("POST /logistique/rfq/[id]/envoyer:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
