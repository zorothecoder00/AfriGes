import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";

/**
 * GET /api/rpv/equipe
 *
 * Retourne les membres de l'équipe PDV groupés par rôle :
 *  - CAISSIER
 *  - COMPTABLE
 *  - MAGAZINIER
 *  - AGENT_TERRAIN
 *  - COMMERCIAL
 *  - RESPONSABLE_VENTE_CREDIT
 *  - CONTROLEUR_TERRAIN
 *
 * Paramètre : rôle (filtre optionnel)
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const roleFiltre = searchParams.get("role") ?? "";
    const search     = searchParams.get("search") ?? "";

    const roles = roleFiltre
      ? [roleFiltre]
      : ["CAISSIER", "COMPTABLE", "MAGAZINIER", "AGENT_TERRAIN",
         "COMMERCIAL", "RESPONSABLE_VENTE_CREDIT", "CONTROLEUR_TERRAIN"];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { role: { in: roles } };

    if (search) {
      where.member = {
        OR: [
          { nom:    { contains: search, mode: "insensitive" } },
          { prenom: { contains: search, mode: "insensitive" } },
          { email:  { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const gestionnaires = await prisma.gestionnaire.findMany({
      where,
      include: {
        member: {
          select: {
            id: true, nom: true, prenom: true, email: true,
            telephone: true, photo: true, etat: true, dateAdhesion: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { member: { nom: "asc" } }],
    });

    // Grouper par rôle
    const parRole: Record<string, typeof gestionnaires> = {};
    for (const g of gestionnaires) {
      if (!parRole[g.role]) parRole[g.role] = [];
      parRole[g.role].push(g);
    }

    // Statistiques par rôle
    const statsParRole: Record<string, { total: number; actifs: number; inactifs: number }> = {};
    for (const [role, membres] of Object.entries(parRole)) {
      statsParRole[role] = {
        total:    membres.length,
        actifs:   membres.filter((m) => m.actif && m.member.etat === "ACTIF").length,
        inactifs: membres.filter((m) => !m.actif || m.member.etat !== "ACTIF").length,
      };
    }

    return NextResponse.json({
      success: true,
      data: gestionnaires.map((g) => ({
        id:     g.id,
        role:   g.role,
        actif:  g.actif,
        member: {
          ...g.member,
          dateAdhesion: g.member.dateAdhesion.toISOString(),
        },
      })),
      parRole:    Object.fromEntries(
        Object.entries(parRole).map(([role, membres]) => [role, membres.map((g) => ({
          id: g.id, role: g.role, actif: g.actif,
          member: { ...g.member, dateAdhesion: g.member.dateAdhesion.toISOString() },
        }))])
      ),
      stats: {
        total:       gestionnaires.length,
        actifs:      gestionnaires.filter((g) => g.actif && g.member.etat === "ACTIF").length,
        parRole:     statsParRole,
      },
    });
  } catch (error) {
    console.error("GET /api/rpv/equipe error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
