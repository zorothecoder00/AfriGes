import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { peutValiderPrix, ROLES_VALIDATION_PRIX } from "@/lib/authCatalogue";
import { extraireMetaRequete, resoudreAgenceOperation } from "@/lib/compteCourant";
import { enregistrerChangementPrix } from "@/lib/prixProduit";
import { notifyAdmins, auditLog } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ demandeId: string }> };

/**
 * PATCH /api/admin/catalogue/demandes-prix/[demandeId] (Catalogue §15)
 * action "APPROUVER" (ré-auth mot de passe requise) → applique le nouveau prix
 * (Produit + ligne de prix GLOBAL miroir + historique) ; "REJETER" (motif requis).
 * Validation réservée à Admin / Chef d'agence / Responsable Marketing.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Non authentifié" }, { status: 401 });
  if (!peutValiderPrix(session.user.role, session.user.gestionnaireRole)) {
    return NextResponse.json({ message: `Validation réservée à : ${ROLES_VALIDATION_PRIX}` }, { status: 403 });
  }

  const demandeId = Number((await params).demandeId);
  if (!demandeId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const demande = await prisma.demandeChangementPrix.findUnique({
    where: { id: demandeId },
    select: { id: true, produitId: true, champ: true, nouveauPrix: true, statut: true, produit: { select: { nom: true } } },
  });
  if (!demande) return NextResponse.json({ message: "Demande introuvable" }, { status: 404 });
  if (demande.statut !== "EN_ATTENTE") return NextResponse.json({ message: "Cette demande est déjà traitée" }, { status: 422 });

  const body = await req.json().catch(() => null);
  const action = body?.action === "REJETER" ? "REJETER" : body?.action === "APPROUVER" ? "APPROUVER" : null;
  if (!action) return NextResponse.json({ message: "Action invalide (APPROUVER ou REJETER)" }, { status: 400 });

  const userId = Number(session.user.id);
  const { ip } = extraireMetaRequete(req);
  const now = new Date();

  // ── Rejet ────────────────────────────────────────────────────────────────
  if (action === "REJETER") {
    const motifRejet = typeof body?.motifRejet === "string" && body.motifRejet.trim() ? body.motifRejet.trim() : null;
    if (!motifRejet) return NextResponse.json({ message: "Le motif de rejet est obligatoire" }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      await tx.demandeChangementPrix.update({ where: { id: demandeId }, data: { statut: "REJETE", valideParId: userId, valideAt: now, motifRejet } });
      await auditLog(tx, userId, "REJET_CHANGEMENT_PRIX", "Produit", demande.produitId, { motifRejet }, { ip });
    });
    return NextResponse.json({ data: { id: demandeId, statut: "REJETE" } });
  }

  // ── Approbation : ré-authentification par mot de passe (Catalogue §15) ─────
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return NextResponse.json({ message: "Mot de passe requis pour valider" }, { status: 400 });
  const valideur = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!valideur?.passwordHash || !(await bcrypt.compare(password, valideur.passwordHash))) {
    return NextResponse.json({ message: "Mot de passe incorrect" }, { status: 401 });
  }

  const nouveauPrix = Number(demande.nouveauPrix);
  const agence = await resoudreAgenceOperation(prisma, userId);

  await prisma.$transaction(async (tx) => {
    // Applique le prix sur le produit (socle) + miroir ligne de prix GLOBAL.
    if (demande.champ === "VENTE") {
      await tx.produit.update({ where: { id: demande.produitId }, data: { prixUnitaire: new Prisma.Decimal(nouveauPrix) } });
      const ligne = await tx.prixProduit.findFirst({ where: { produitId: demande.produitId, type: "DETAIL", portee: "GLOBAL" }, select: { id: true } });
      if (ligne) await tx.prixProduit.update({ where: { id: ligne.id }, data: { montant: new Prisma.Decimal(nouveauPrix) } });
    } else {
      await tx.produit.update({ where: { id: demande.produitId }, data: { prixAchat: new Prisma.Decimal(nouveauPrix) } });
      const ligne = await tx.prixProduit.findFirst({ where: { produitId: demande.produitId, type: "ACHAT", portee: "GLOBAL" }, select: { id: true } });
      if (ligne) await tx.prixProduit.update({ where: { id: ligne.id }, data: { montant: new Prisma.Decimal(nouveauPrix) } });
    }

    // Historique de prix (Catalogue §5) avec IP, agence, validateur.
    const hist = await enregistrerChangementPrix(tx, {
      produitId: demande.produitId,
      nouveauPrixVente: demande.champ === "VENTE" ? nouveauPrix : undefined,
      nouveauPrixAchat: demande.champ === "ACHAT" ? nouveauPrix : undefined,
      source: "VALIDATION", motif: `Validé — demande #${demandeId}`, userId,
    });
    if (hist) {
      await tx.historiquePrixProduit.update({ where: { id: hist.id }, data: { ip, agence, valideParId: userId } });
    }

    await tx.demandeChangementPrix.update({ where: { id: demandeId }, data: { statut: "APPROUVE", valideParId: userId, valideAt: now } });
    await auditLog(tx, userId, "VALIDATION_CHANGEMENT_PRIX", "Produit", demande.produitId, { champ: demande.champ, nouveauPrix }, { ip });
    await notifyAdmins(tx, {
      titre: "Changement de prix validé",
      message: `Le prix ${demande.champ === "VENTE" ? "de vente" : "d'achat"} de « ${demande.produit.nom} » est passé à ${nouveauPrix.toLocaleString("fr-FR")} FCFA (validé par ${session.user.prenom} ${session.user.nom}).`,
      priorite: PrioriteNotification.NORMAL,
      actionUrl: `/dashboard/admin/catalogue/produits`,
    });
  });

  return NextResponse.json({ data: { id: demandeId, statut: "APPROUVE", nouveauPrix } });
}
