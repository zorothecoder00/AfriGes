import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { estAutoriseMessagerie } from "@/lib/messagerie";

/**
 * GET /api/messages/utilisateurs?search=
 * Répertoire de contacts pour démarrer une conversation — réservé aux gestionnaires
 * (Admin/Super-admin ou profil Gestionnaire actif). Exclut l'appelant et les
 * utilisateurs simples (rôle USER sans profil gestionnaire actif).
 */
export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
  const userId = Number(session.user.id);
  if (!(await estAutoriseMessagerie(prisma, userId))) {
    return NextResponse.json({ message: "Messagerie réservée aux gestionnaires" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") ?? "").trim();

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      OR: [
        { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        { gestionnaire: { actif: true } },
      ],
      ...(search
        ? { AND: [{ OR: [
            { nom: { contains: search, mode: "insensitive" } },
            { prenom: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ] }] }
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
