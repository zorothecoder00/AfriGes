import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";
import { Prisma, MemberStatus, SegmentClient } from "@prisma/client";

// Recherche de clients pour les membres de commission (préparation des dossiers
// de financement). Lecture seule, champs minimaux, recherche nom/prénom/téléphone/code.
export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const limit  = Math.min(parseInt(searchParams.get("limit") ?? "8"), 20);

    if (search.length < 2) return NextResponse.json({ data: [] });

    const conditions: Prisma.ClientWhereInput[] = [
      { nom:        { contains: search, mode: "insensitive" } },
      { prenom:     { contains: search, mode: "insensitive" } },
      { telephone:  { contains: search, mode: "insensitive" } },
      { codeClient: { contains: search, mode: "insensitive" } },
    ];
    const parts = search.split(/\s+/);
    if (parts.length >= 2) {
      const [first, ...rest] = parts; const restStr = rest.join(" ");
      conditions.push({ AND: [{ prenom: { contains: first, mode: "insensitive" } }, { nom: { contains: restStr, mode: "insensitive" } }] });
      conditions.push({ AND: [{ nom: { contains: first, mode: "insensitive" } }, { prenom: { contains: restStr, mode: "insensitive" } }] });
    }

    const clients = await prisma.client.findMany({
      where: { OR: conditions },
      select: { id: true, nom: true, prenom: true, telephone: true, ville: true, codeClient: true },
      orderBy: { nom: "asc" },
      take: limit,
    });

    return NextResponse.json({ data: clients });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Création d'un client (préparation d'une demande de financement par un membre de commission).
// Champs minimaux : nom, prénom, téléphone. Renvoie { data: { id, nom, prenom } }.
export async function POST(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { nom, prenom, telephone } = await req.json();
    if (!nom?.trim() || !prenom?.trim() || !telephone?.trim()) {
      return NextResponse.json({ message: "Nom, prénom et téléphone requis" }, { status: 400 });
    }

    const existing = await prisma.client.findUnique({ where: { telephone } });
    if (existing) return NextResponse.json({ message: "Ce numéro de téléphone est déjà utilisé" }, { status: 409 });

    const client = await prisma.$transaction(async (tx) => {
      const total = await tx.client.count();
      return tx.client.create({
        data: {
          nom: nom.trim(),
          prenom: prenom.trim(),
          telephone: telephone.trim(),
          codeClient: `CLI-${String(total + 1).padStart(5, "0")}`,
          etat: MemberStatus.ACTIF,
          segment: SegmentClient.ORDINAIRE,
          soldeActuel: 0,
        },
        select: { id: true, nom: true, prenom: true },
      });
    });

    return NextResponse.json({ data: client }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Erreur lors de la création du client" }, { status: 500 });
  }
}
