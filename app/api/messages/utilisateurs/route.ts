import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/messages/utilisateurs?search=
 * Répertoire de contacts pour démarrer une conversation — ouvert à tout utilisateur
 * connecté (admin, gestionnaire de tout rôle, membre simple). Exclut l'appelant.
 */
export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
  const userId = Number(session.user.id);

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") ?? "").trim();

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      ...(search
        ? { OR: [
            { nom: { contains: search, mode: "insensitive" } },
            { prenom: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ] }
        : {}),
    },
    select: {
      id: true, nom: true, prenom: true, email: true, photo: true, role: true,
      gestionnaire: { select: { role: true, actif: true } },
    },
    orderBy: [{ prenom: "asc" }, { nom: "asc" }],
    take: 30,
  });

  const data = users.map((u) => ({
    id: u.id, nom: u.nom, prenom: u.prenom, email: u.email, photo: u.photo,
    role: u.role, gestionnaireRole: u.gestionnaire?.actif ? u.gestionnaire.role : null,
  }));

  return NextResponse.json({ data });
}
