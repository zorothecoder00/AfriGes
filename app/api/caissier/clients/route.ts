import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";

const DIACRITICS_RE = /[̀-ͯ]/g;

function normalise(s: string) {
  return s.toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "").replace(/\s+/g, "");
}

/**
 * GET /api/caissier/clients
 * Recherche de clients rattachés au PDV du caissier.
 * Query: search, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const limit  = Math.min(20, Math.max(1, Number(searchParams.get("limit") || 10)));

    // Filtre PDV — conservé dans son propre bloc AND (jamais fusionné avec le
    // filtre de recherche : les deux utilisent la clé "OR", un spread naïf
    // écraserait silencieusement la restriction PDV dès qu'une recherche est saisie).
    const pdvWhere: Prisma.ClientWhereInput | null = pdvId
      ? {
          OR: [
            { pointDeVenteId: pdvId },
            { pointsDeVente: { some: { pointDeVenteId: pdvId } } },
          ],
        }
      : null;

    const searchWhere: Prisma.ClientWhereInput | null = search
      ? (() => {
          const parts = search.split(/\s+/);
          const conditions: Prisma.ClientWhereInput[] = [
            { nom:       { contains: search, mode: "insensitive" } },
            { prenom:    { contains: search, mode: "insensitive" } },
            { telephone: { contains: search, mode: "insensitive" } },
          ];
          if (parts.length >= 2) {
            const [first, ...rest] = parts;
            const restStr = rest.join(" ");
            conditions.push({
              AND: [
                { prenom: { contains: first,   mode: "insensitive" } },
                { nom:    { contains: restStr, mode: "insensitive" } },
              ],
            });
            conditions.push({
              AND: [
                { nom:    { contains: first,   mode: "insensitive" } },
                { prenom: { contains: restStr, mode: "insensitive" } },
              ],
            });
          }
          return { OR: conditions };
        })()
      : null;

    const andConditions = [pdvWhere, searchWhere].filter((c): c is Prisma.ClientWhereInput => c !== null);
    const where: Prisma.ClientWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    const selectFields = {
      id:        true,
      nom:       true,
      prenom:    true,
      telephone: true,
      adresse:   true,
      segment:   true,
      tags: { select: { tag: { select: { id: true, nom: true, couleur: true } } } },
    } as const;

    let clients = await prisma.client.findMany({
      where,
      take: limit,
      orderBy: { nom: "asc" },
      select: selectFields,
    });

    // Repli : recherche saisie sans espace entre nom et prénom (ex: "MarieDupont").
    // Le "contains" Prisma ne peut pas comparer une concaténation de deux colonnes,
    // donc on retente sur un lot borné de clients du PDV, filtré en JS.
    const searchSansEspace = search.replace(/\s+/g, "");
    if (clients.length === 0 && searchSansEspace.length >= 3 && !/\s/.test(search)) {
      const candidats = await prisma.client.findMany({
        where: pdvWhere ?? {},
        take: 300,
        orderBy: { nom: "asc" },
        select: selectFields,
      });
      const cible = normalise(searchSansEspace);
      clients = candidats
        .filter((c) => {
          const nomPrenom = normalise(`${c.nom}${c.prenom}`);
          const prenomNom = normalise(`${c.prenom}${c.nom}`);
          return nomPrenom.includes(cible) || prenomNom.includes(cible);
        })
        .slice(0, limit);
    }

    return NextResponse.json({ success: true, data: clients });
  } catch (error) {
    console.error("GET /api/caissier/clients", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
