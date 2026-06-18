import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession, isPresident } from "@/lib/authCommissionRIA";
import { RoleMembreCommissionRIA } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

// Garantit que l'appelant peut gérer ce membre : Président de la commission du
// membre, ou supervision (Admin/RESPONSABLE_RIA → auth.commission === null).
// Retourne le membre ciblé ou une réponse d'erreur.
async function autoriser(membreId: number) {
  const auth = await getCommissionMembreSession();
  if (!auth) return { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };

  const cible = await prisma.membreCommissionRIA.findUnique({
    where: { id: membreId },
    select: { id: true, typeCommission: true, userId: true, role: true },
  });
  if (!cible) return { error: NextResponse.json({ error: "Membre introuvable" }, { status: 404 }) };

  const callerId = parseInt(auth.session.user.id);
  const superviseur = auth.commission === null;
  if (!superviseur && !(await isPresident(callerId, cible.typeCommission))) {
    return {
      error: NextResponse.json(
        { error: "La gestion des membres est réservée au Président de la commission" },
        { status: 403 }
      ),
    };
  }

  return { cible, callerId, superviseur };
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const membreId = parseInt(id);
    const guard = await autoriser(membreId);
    if (guard.error) return guard.error;
    const { cible, callerId, superviseur } = guard;

    const body = await req.json();
    const { role, notes, actif } = body;

    // Un président ne peut pas se rétrograder ni se désactiver lui-même (anti-blocage).
    if (!superviseur && cible.userId === callerId) {
      if ((role !== undefined && role !== "PRESIDENT") || actif === false) {
        return NextResponse.json(
          { error: "Vous ne pouvez pas modifier votre propre statut de Président" },
          { status: 409 }
        );
      }
    }

    const membre = await prisma.membreCommissionRIA.update({
      where: { id: membreId },
      data: {
        ...(role !== undefined ? { role: role as RoleMembreCommissionRIA } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(actif !== undefined ? { actif, ...(actif === false ? { dateSortie: new Date() } : { dateSortie: null }) } : {}),
      },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });

    return NextResponse.json(membre);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const membreId = parseInt(id);
    const guard = await autoriser(membreId);
    if (guard.error) return guard.error;
    const { cible, callerId, superviseur } = guard;

    // Un président ne peut pas se retirer lui-même (anti-blocage).
    if (!superviseur && cible.userId === callerId) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas vous retirer vous-même de la commission" },
        { status: 409 }
      );
    }

    await prisma.membreCommissionRIA.update({
      where: { id: membreId },
      data: { actif: false, dateSortie: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
