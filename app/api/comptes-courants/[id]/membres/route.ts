import { NextResponse } from "next/server";
import { RoleMembreCC } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { extraireMetaRequete } from "@/lib/compteCourant";
import { notifyAdmins, auditLog } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

// Un compte a déjà son titulaire (fixé à l'ouverture) : on n'ajoute que des MANDATAIRE/MEMBRE.
const ROLES_MEMBRE = ["MANDATAIRE", "MEMBRE"] as const;

/**
 * Membres d'un compte courant collectif (CDC §19.A).
 * GET  — liste des membres — capacité READ
 * POST — ajoute un membre (comptes collectifs uniquement) — capacité CREATE
 */

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const compteId = Number((await params).id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const membres = await prisma.membreCompteCourant.findMany({
    where: { compteId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, role: true, quotePart: true, createdAt: true,
      client: { select: { id: true, nom: true, prenom: true, telephone: true, codeClient: true, photoUrl: true } },
    },
  });

  return NextResponse.json({ data: membres });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("CREATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const compteId = Number((await params).id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: { id: true, numeroCompte: true, typeCompte: true, libelle: true, clientId: true },
  });
  if (!compte) return NextResponse.json({ error: "Compte courant introuvable" }, { status: 404 });
  if (compte.typeCompte === "INDIVIDUEL") {
    return NextResponse.json({ error: "Un compte individuel n'a qu'un seul titulaire" }, { status: 422 });
  }

  const body = await req.json().catch(() => null);
  const clientId = Number(body?.clientId);
  if (!clientId) return NextResponse.json({ error: "Client requis" }, { status: 400 });

  const role: RoleMembreCC = ROLES_MEMBRE.includes(body?.role) ? body.role : "MEMBRE";
  const qp = body?.quotePart != null && body.quotePart !== "" ? Number(body.quotePart) : null;
  const quotePart = qp != null && !isNaN(qp) && qp >= 0 ? qp : null;

  const client = await prisma.client.findUnique({
    where: { id: clientId }, select: { id: true, nom: true, prenom: true },
  });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  const deja = await prisma.membreCompteCourant.findUnique({
    where: { compteId_clientId: { compteId, clientId } }, select: { id: true },
  });
  if (deja) return NextResponse.json({ error: "Ce client est déjà membre du compte" }, { status: 409 });

  const userId = Number(session.user.id);
  const { ip, userAgent } = extraireMetaRequete(req);

  const membre = await prisma.$transaction(async (tx) => {
    const created = await tx.membreCompteCourant.create({
      data: { compteId, clientId, role, quotePart, ajouteParId: userId },
      select: {
        id: true, role: true, quotePart: true, createdAt: true,
        client: { select: { id: true, nom: true, prenom: true, telephone: true, codeClient: true, photoUrl: true } },
      },
    });
    await auditLog(tx, userId, "AJOUT_MEMBRE_COMPTE_COURANT", "CompteCourant", compteId, undefined, { ip, userAgent });
    await notifyAdmins(tx, {
      titre: "Membre ajouté à un compte collectif",
      message: `${client.prenom} ${client.nom} (${role.toLowerCase()}) ajouté au compte ${compte.libelle ?? compte.numeroCompte}.`,
      priorite: PrioriteNotification.NORMAL,
      actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
    });
    return created;
  });

  return NextResponse.json({ data: membre }, { status: 201 });
}
