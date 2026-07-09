import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { extraireMetaRequete, montantBloqueActif } from "@/lib/compteCourant";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

const blocageSelect = {
  id: true, montant: true, motif: true, dateBlocage: true, dateDeblocage: true,
  statut: true, libereLe: true, createdAt: true,
  creePar: { select: { nom: true, prenom: true } },
};

/**
 * Blocages volontaires d'épargne d'un compte (CDC §19.E).
 * GET  — liste + montant bloqué actif + solde disponible — capacité READ
 * POST — bloque une partie du solde jusqu'à une date — capacité CREATE
 */

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const compteId = Number((await params).id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const compte = await prisma.compteCourant.findUnique({ where: { id: compteId }, select: { solde: true } });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  const [blocages, montantBloque] = await Promise.all([
    prisma.blocageEpargne.findMany({
      where: { compteId },
      orderBy: [{ statut: "asc" }, { dateDeblocage: "asc" }],
      select: blocageSelect,
    }),
    montantBloqueActif(prisma, compteId),
  ]);

  const solde = Number(compte.solde);
  return NextResponse.json({
    data: {
      solde,
      montantBloque,
      soldeDisponible: solde - montantBloque,
      blocages: blocages.map((b) => ({ ...b, montant: Number(b.montant) })),
    },
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("CREATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const compteId = Number((await params).id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: { id: true, numeroCompte: true, statut: true, solde: true, libelle: true, client: { select: { prenom: true, nom: true } } },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  if (compte.statut !== "ACTIF") {
    return NextResponse.json({ error: `Compte ${compte.statut.toLowerCase()} : blocage impossible` }, { status: 422 });
  }

  const body = await req.json().catch(() => null);
  const montant = Number(body?.montant);
  const motif = typeof body?.motif === "string" && body.motif.trim() ? body.motif.trim() : null;
  if (!montant || isNaN(montant) || montant <= 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }
  const dateDeblocage = body?.dateDeblocage ? new Date(body.dateDeblocage) : null;
  if (!dateDeblocage || isNaN(dateDeblocage.getTime())) {
    return NextResponse.json({ error: "Date de déblocage requise" }, { status: 400 });
  }
  if (dateDeblocage <= new Date()) {
    return NextResponse.json({ error: "La date de déblocage doit être future" }, { status: 400 });
  }

  // On ne peut bloquer que ce qui est disponible (solde − déjà bloqué).
  const dejaBloque = await montantBloqueActif(prisma, compteId);
  const disponible = Number(compte.solde) - dejaBloque;
  if (montant > disponible) {
    return NextResponse.json(
      { error: `Montant supérieur au solde disponible (${Math.max(0, disponible).toLocaleString("fr-FR")} FCFA${dejaBloque > 0 ? `, ${dejaBloque.toLocaleString("fr-FR")} FCFA déjà bloqués` : ""})` },
      { status: 422 },
    );
  }

  const userId = Number(session.user.id);
  const { ip, userAgent } = extraireMetaRequete(req);
  const clientNom = `${compte.client.prenom} ${compte.client.nom}`;

  const created = await prisma.$transaction(async (tx) => {
    const b = await tx.blocageEpargne.create({
      data: { compteId, montant, motif, dateDeblocage, creeParId: userId },
      select: blocageSelect,
    });
    await auditLog(tx, userId, "CREATION_BLOCAGE_EPARGNE", "CompteCourant", compteId, { montant, dateDeblocage: dateDeblocage.toISOString() }, { ip, userAgent });
    await notifyAdmins(tx, {
      titre: "Épargne bloquée",
      message: `${montant.toLocaleString("fr-FR")} FCFA bloqués sur le compte ${compte.libelle ?? compte.numeroCompte} (${clientNom}) jusqu'au ${dateDeblocage.toLocaleDateString("fr-FR")}.`,
      priorite: PrioriteNotification.NORMAL,
      actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
    });
    return b;
  });

  return NextResponse.json({ data: { ...created, montant: Number(created.montant) } }, { status: 201 });
}
