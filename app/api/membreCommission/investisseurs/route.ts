import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";

// Création d'un investisseur RIA (compte + profil + portefeuille) par un membre de
// commission, lors de la préparation d'une demande de financement.
// Renvoie { data: { ..., portefeuille } } pour récupérer l'id du portefeuille créé.
export async function POST(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { nom, prenom, email, telephone, nomPortefeuille } = await req.json();
    if (!nom?.trim() || !prenom?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "nom, prenom et email sont obligatoires" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });

    const passwordHash = await bcrypt.hash(Math.random().toString(36).slice(2, 10), 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          nom, prenom, email,
          telephone: telephone ?? null,
          passwordHash,
          mustChangePassword: true,
          role: "USER",
        },
      });
      const gestionnaire = await tx.gestionnaire.create({
        data: { memberId: user.id, role: "INVESTISSEUR_RIA" },
      });
      const nbProfils = await tx.profilInvestisseurRIA.count();
      const profil = await tx.profilInvestisseurRIA.create({
        data: { gestionnaireId: gestionnaire.id, numero: `INV-${String(nbProfils + 1).padStart(5, "0")}` },
      });
      const count = await tx.portefeuilleRIA.count();
      const portefeuille = await tx.portefeuilleRIA.create({
        data: {
          reference: `PF-${String(count + 1).padStart(5, "0")}`,
          profilRIAId: profil.id,
          nom: nomPortefeuille ?? "Portefeuille Principal",
        },
      });
      return { user: { id: user.id, nom: user.nom, prenom: user.prenom }, profil: { id: profil.id, numero: profil.numero }, portefeuille };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
