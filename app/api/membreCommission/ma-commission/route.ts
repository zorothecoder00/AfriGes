import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";

// Infos de la/des commissions du membre connecté
export async function GET() {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);

    const memberships = await prisma.membreCommissionRIA.findMany({
      where: { userId, actif: true },
      select: {
        id: true, typeCommission: true, role: true, dateEntree: true,
      },
    });

    if (memberships.length === 0) {
      return NextResponse.json({ error: "Aucune commission active" }, { status: 404 });
    }

    const commissions = await Promise.all(
      memberships.map(async (m) => {
        const [membres, prochaine, plansAssignes, dossiersEnCours, obsRecentes] = await Promise.all([
          prisma.membreCommissionRIA.findMany({
            where: { typeCommission: m.typeCommission, actif: true },
            include: { user: { select: { id: true, nom: true, prenom: true, photo: true } } },
          }),
          prisma.reunionCommissionRIA.findFirst({
            where: { typeCommission: m.typeCommission, statut: "PLANIFIEE", dateHeure: { gte: new Date() } },
            orderBy: { dateHeure: "asc" },
            select: { id: true, titre: true, dateHeure: true, lieu: true, convocationEnvoyee: true },
          }),
          prisma.planActionCommRIA.findMany({
            where: {
              typeCommission: m.typeCommission,
              responsableId:  userId,
              statut: { notIn: ["TERMINE", "REALISE", "ABANDONNE"] },
            },
            select: { id: true, titre: true, statut: true, dateEcheance: true, priorite: true },
            take: 5,
          }),
          prisma.dossierInterCommission.count({
            where: {
              commissionReceptrice: m.typeCommission,
              statut: { in: ["RECU", "EN_ANALYSE", "EN_ATTENTE_DECISION"] },
            },
          }),
          prisma.observationCommissionRIA.findMany({
            where: { typeCommission: m.typeCommission },
            include: { auteur: { select: { id: true, nom: true, prenom: true } } },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
        ]);

        return {
          typeCommission: m.typeCommission,
          role:           m.role,
          membres,
          prochainReunion: prochaine,
          plansAssignes,
          nbDossiersEnCours: dossiersEnCours,
          obsRecentes,
        };
      })
    );

    return NextResponse.json({ commissions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
