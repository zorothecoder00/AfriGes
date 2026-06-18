import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession, isPresident } from "@/lib/authCommissionRIA";
import { creerCompteMembreCommission, CompteMembreError } from "@/lib/commissionMembreCompte";
import { TypeCommissionRIA, RoleMembreCommissionRIA } from "@prisma/client";

// Liste des membres d'une commission dont l'appelant est membre/président.
export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const { searchParams } = new URL(req.url);
    const typeCommission = searchParams.get("typeCommission") as TypeCommissionRIA | null;

    // Admin/RESPONSABLE_RIA (auth.commission === null) voient tout ; sinon on
    // restreint aux commissions dont l'appelant est membre actif.
    let types: TypeCommissionRIA[];
    if (auth.commission === null) {
      types = typeCommission ? [typeCommission] : Object.values(TypeCommissionRIA);
    } else {
      const memberships = await prisma.membreCommissionRIA.findMany({
        where: { userId, actif: true },
        select: { typeCommission: true },
      });
      types = memberships.map((m) => m.typeCommission);
      if (typeCommission) types = types.filter((t) => t === typeCommission);
    }

    const membres = await prisma.membreCommissionRIA.findMany({
      where: { typeCommission: { in: types }, actif: true },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true, photo: true } },
      },
      orderBy: [{ typeCommission: "asc" }, { role: "asc" }],
    });

    return NextResponse.json({ membres });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Ajout / réactivation d'un membre — réservé au Président de la commission
// (CDC : « Attribution des tâches » / gestion de son équipe). Admin/RESPONSABLE_RIA
// (auth.commission === null) outrepassent le gating.
export async function POST(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const body = await req.json();
    const { typeCommission, userId: cibleId, role, notes, nouveauCompte } = body;

    if (!typeCommission) {
      return NextResponse.json({ error: "typeCommission requis" }, { status: 400 });
    }
    if (!Object.values(TypeCommissionRIA).includes(typeCommission)) {
      return NextResponse.json({ error: "Type de commission invalide" }, { status: 400 });
    }

    // Gating CDC : Président de la commission, ou supervision (Admin/RESPONSABLE_RIA → auth.commission === null).
    if (auth.commission !== null && !(await isPresident(userId, typeCommission as TypeCommissionRIA))) {
      return NextResponse.json(
        { error: "La gestion des membres est réservée au Président de la commission" },
        { status: 403 }
      );
    }

    const roleMembre = (role as RoleMembreCommissionRIA) ?? "RAPPORTEUR_2";

    // ── Cas A : créer un compte membre (identifiant + mot de passe) puis le siège ──
    if (!cibleId && nouveauCompte) {
      try {
        const { membre, motDePasseTemporaire } = await creerCompteMembreCommission({
          typeCommission, role: roleMembre, notes, compte: nouveauCompte,
        });
        return NextResponse.json(
          { ...membre, compteCree: { email: membre.user.email, motDePasseTemporaire } },
          { status: 201 }
        );
      } catch (err) {
        if (err instanceof CompteMembreError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }
    }

    // ── Cas B : ajouter / réactiver un utilisateur existant ────────────────────────
    if (!cibleId) {
      return NextResponse.json({ error: "userId ou nouveauCompte requis" }, { status: 400 });
    }

    const membre = await prisma.membreCommissionRIA.upsert({
      where: { typeCommission_userId: { typeCommission, userId: Number(cibleId) } },
      create: {
        typeCommission,
        userId: Number(cibleId),
        role: roleMembre,
        notes,
        actif: true,
      },
      update: {
        role: roleMembre,
        notes,
        actif: true,
        dateSortie: null,
      },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });

    return NextResponse.json(membre, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
