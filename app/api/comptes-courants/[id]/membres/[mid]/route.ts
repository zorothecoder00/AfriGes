import { NextResponse } from "next/server";
import { RoleMembreCC } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { extraireMetaRequete } from "@/lib/compteCourant";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string; mid: string }> };

/**
 * Membre d'un compte courant collectif (CDC §19.A).
 * PATCH  — modifie le rôle (MANDATAIRE/MEMBRE) ou la quote-part — capacité CREATE
 * DELETE — retire un membre (jamais le titulaire principal) — capacité CREATE
 */

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("CREATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id, mid } = await params;
  const compteId = Number(id);
  const membreId = Number(mid);
  if (!compteId || !membreId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const membre = await prisma.membreCompteCourant.findFirst({
    where: { id: membreId, compteId }, select: { id: true, role: true },
  });
  if (!membre) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
  if (membre.role === "TITULAIRE") {
    return NextResponse.json({ error: "Le titulaire principal ne peut pas être modifié ici" }, { status: 422 });
  }

  const body = await req.json().catch(() => null);
  const data: { role?: RoleMembreCC; quotePart?: number | null } = {};

  if (body?.role != null) {
    // On n'autorise pas la promotion en TITULAIRE via cette route (titulaire fixé à l'ouverture).
    if (!["MANDATAIRE", "MEMBRE"].includes(body.role)) {
      return NextResponse.json({ error: "Rôle invalide (MANDATAIRE ou MEMBRE)" }, { status: 400 });
    }
    data.role = body.role;
  }
  if (body?.quotePart !== undefined) {
    if (body.quotePart === null || body.quotePart === "") {
      data.quotePart = null;
    } else {
      const qp = Number(body.quotePart);
      if (isNaN(qp) || qp < 0) return NextResponse.json({ error: "Quote-part invalide" }, { status: 400 });
      data.quotePart = qp;
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const userId = Number(session.user.id);
  const { ip, userAgent } = extraireMetaRequete(req);

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.membreCompteCourant.update({
      where: { id: membreId },
      data,
      select: {
        id: true, role: true, quotePart: true, createdAt: true,
        client: { select: { id: true, nom: true, prenom: true, telephone: true, codeClient: true, photoUrl: true } },
      },
    });
    await auditLog(tx, userId, "MODIFICATION_MEMBRE_COMPTE_COURANT", "CompteCourant", compteId, undefined, { ip, userAgent });
    return m;
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("CREATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id, mid } = await params;
  const compteId = Number(id);
  const membreId = Number(mid);
  if (!compteId || !membreId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const membre = await prisma.membreCompteCourant.findFirst({
    where: { id: membreId, compteId },
    select: { id: true, role: true, client: { select: { nom: true, prenom: true } } },
  });
  if (!membre) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
  if (membre.role === "TITULAIRE") {
    return NextResponse.json({ error: "Le titulaire principal ne peut pas être retiré" }, { status: 422 });
  }

  const userId = Number(session.user.id);
  const { ip, userAgent } = extraireMetaRequete(req);

  await prisma.$transaction(async (tx) => {
    await tx.membreCompteCourant.delete({ where: { id: membreId } });
    await auditLog(tx, userId, "RETRAIT_MEMBRE_COMPTE_COURANT", "CompteCourant", compteId, undefined, { ip, userAgent });
  });

  return NextResponse.json({ data: { id: membreId } });
}
