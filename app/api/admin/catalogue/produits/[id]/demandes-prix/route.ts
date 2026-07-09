import { NextResponse } from "next/server";
import { Prisma, ChampPrixDemande } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { extraireMetaRequete, resoudreAgenceOperation } from "@/lib/compteCourant";
import { notifyRoles, auditLog } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Demandes de changement de prix d'un produit (Catalogue §5, §15).
 * GET  — historique des demandes du produit — admin.
 * POST — soumet une demande (champ VENTE/ACHAT + nouveau prix + motif). Elle devra
 *        être validée par un Chef d'agence / Admin / Resp. Marketing.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const demandes = await prisma.demandeChangementPrix.findMany({
    where: { produitId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, champ: true, ancienPrix: true, nouveauPrix: true, motif: true, statut: true,
      agence: true, createdAt: true, valideAt: true, motifRejet: true,
      demandePar: { select: { nom: true, prenom: true } },
      validePar: { select: { nom: true, prenom: true } },
    },
  });

  return NextResponse.json({
    data: demandes.map((d) => ({ ...d, ancienPrix: d.ancienPrix != null ? Number(d.ancienPrix) : null, nouveauPrix: Number(d.nouveauPrix) })),
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const produit = await prisma.produit.findUnique({ where: { id: produitId }, select: { id: true, nom: true, prixUnitaire: true, prixAchat: true } });
  if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const champ = body?.champ as ChampPrixDemande;
  if (champ !== "VENTE" && champ !== "ACHAT") return NextResponse.json({ message: "Champ invalide (VENTE ou ACHAT)" }, { status: 400 });
  const nouveauPrix = Number(body?.nouveauPrix);
  if (isNaN(nouveauPrix) || nouveauPrix < 0) return NextResponse.json({ message: "Nouveau prix invalide" }, { status: 400 });
  if (champ === "VENTE" && nouveauPrix <= 0) return NextResponse.json({ message: "Le prix de vente doit être supérieur à 0" }, { status: 400 });
  const motif = typeof body?.motif === "string" && body.motif.trim() ? body.motif.trim() : null;
  if (!motif) return NextResponse.json({ message: "Le motif est obligatoire" }, { status: 400 });

  const ancienPrix = champ === "VENTE" ? Number(produit.prixUnitaire) : (produit.prixAchat != null ? Number(produit.prixAchat) : null);
  if (ancienPrix != null && ancienPrix === nouveauPrix) {
    return NextResponse.json({ message: "Le nouveau prix est identique au prix actuel" }, { status: 400 });
  }

  // Une seule demande EN_ATTENTE par (produit, champ) à la fois.
  const enAttente = await prisma.demandeChangementPrix.findFirst({
    where: { produitId, champ, statut: "EN_ATTENTE" }, select: { id: true },
  });
  if (enAttente) return NextResponse.json({ message: "Une demande est déjà en attente pour ce prix" }, { status: 409 });

  const userId = Number(session.user.id);
  const { ip } = extraireMetaRequete(req);
  const agence = await resoudreAgenceOperation(prisma, userId);

  const created = await prisma.$transaction(async (tx) => {
    const d = await tx.demandeChangementPrix.create({
      data: {
        produitId, champ, ancienPrix: ancienPrix != null ? new Prisma.Decimal(ancienPrix) : null,
        nouveauPrix: new Prisma.Decimal(nouveauPrix), motif, demandeParId: userId, ip, agence,
      },
      select: { id: true, champ: true, nouveauPrix: true, statut: true },
    });
    await auditLog(tx, userId, "DEMANDE_CHANGEMENT_PRIX", "Produit", produitId, { champ, ancienPrix, nouveauPrix }, { ip });
    await notifyRoles(tx, ["CHEF_AGENCE", "RESPONSABLE_MARKETING"], {
      titre: "Changement de prix à valider",
      message: `${session.user.prenom} ${session.user.nom} demande de passer le prix ${champ === "VENTE" ? "de vente" : "d'achat"} de « ${produit.nom} » à ${nouveauPrix.toLocaleString("fr-FR")} FCFA. Motif : ${motif}.`,
      priorite: PrioriteNotification.HAUTE,
      actionUrl: `/dashboard/admin/catalogue/prix-validation`,
    });
    return d;
  });

  return NextResponse.json({ data: { ...created, nouveauPrix: Number(created.nouveauPrix) } }, { status: 201 });
}
