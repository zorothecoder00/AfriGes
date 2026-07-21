import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { resolveViewAs } from "@/lib/viewAs";
import { resolveUserPdvs } from "@/lib/userPdv";

/**
 * GET /api/catalogue/interne/pdv
 * Points de vente sélectionnables dans le filtre du catalogue interne.
 * Cloisonnement : un utilisateur rattaché ne reçoit QUE ses propres PDV ; un
 * compte transverse sans PDV (Admin) reçoit tous les PDV actifs du réseau.
 */
export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  const viewAs  = isAdmin ? resolveViewAs(req) : null;
  const userId  = viewAs?.userId ?? Number(session.user.id);
  const myPdvs  = await resolveUserPdvs(userId);

  // Utilisateur rattaché → uniquement son périmètre. Sinon (Admin) → réseau complet.
  const pdvs = myPdvs.length > 0
    ? myPdvs
    : await prisma.pointDeVente.findMany({
        where: { actif: true },
        select: { id: true, nom: true, code: true },
        orderBy: { nom: "asc" },
      });

  return NextResponse.json({ data: pdvs });
}
