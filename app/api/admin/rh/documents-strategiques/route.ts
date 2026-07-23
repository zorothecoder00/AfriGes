import { NextRequest, NextResponse } from "next/server";
import { Prisma, TypeDocumentStrategiqueRH, StatutDocumentStrategique } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";

/**
 * GET /api/admin/rh/documents-strategiques?type=&statut=&pointDeVenteId=
 * Liste les documents RH stratégiques (manuels, politiques, règlement, codes,
 * plans d'évacuation rattachés à un site via pointDeVenteId).
 */
export async function GET(req: NextRequest) {
  const session = await getRHSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type           = searchParams.get("type")   as TypeDocumentStrategiqueRH | null;
  const statut         = searchParams.get("statut") as StatutDocumentStrategique | null;
  const pointDeVenteId = searchParams.get("pointDeVenteId");

  const where: Prisma.DocumentStrategiqueRHWhereInput = {
    ...(type ? { type } : {}),
    ...(statut ? { statut } : {}),
    ...(pointDeVenteId ? { pointDeVenteId: Number(pointDeVenteId) } : {}),
  };

  const data = await prisma.documentStrategiqueRH.findMany({
    where,
    orderBy: [{ type: "asc" }, { version: "desc" }],
    include: { pointDeVente: { select: { id: true, nom: true, code: true } } },
  });

  return NextResponse.json({ data });
}

/**
 * POST /api/admin/rh/documents-strategiques
 * Crée un document (ou une nouvelle version). Versionning auto par (type, pointDeVenteId).
 * Body: { type, titre, reference?, description?, contenu?, fichierUrl?, dateEffet?, statut?, pointDeVenteId? }
 */
export async function POST(req: NextRequest) {
  const session = await getRHSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  try {
    const body = await req.json();
    const { type, titre, reference, description, contenu, fichierUrl, dateEffet, statut, pointDeVenteId } = body ?? {};

    if (!type || !titre?.trim()) {
      return NextResponse.json({ error: "Type et titre sont obligatoires" }, { status: 400 });
    }

    const pdvId = pointDeVenteId ? Number(pointDeVenteId) : null;

    const last = await prisma.documentStrategiqueRH.findFirst({
      where:   { type: type as TypeDocumentStrategiqueRH, pointDeVenteId: pdvId },
      orderBy: { version: "desc" },
      select:  { version: true },
    });
    const version = (last?.version ?? 0) + 1;
    const statutFinal: StatutDocumentStrategique = statut === "EN_VIGUEUR" ? "EN_VIGUEUR" : "BROUILLON";

    const doc = await prisma.$transaction(async (tx) => {
      // Une seule version EN_VIGUEUR par (type, site) : archiver les précédentes le cas échéant.
      // Scoper par pointDeVenteId (y compris null) pour ne pas archiver le document d'un autre site.
      if (statutFinal === "EN_VIGUEUR") {
        await tx.documentStrategiqueRH.updateMany({
          where: { type: type as TypeDocumentStrategiqueRH, pointDeVenteId: pdvId, statut: "EN_VIGUEUR" },
          data:  { statut: "ARCHIVE" },
        });
      }
      return tx.documentStrategiqueRH.create({
        data: {
          type: type as TypeDocumentStrategiqueRH,
          titre: titre.trim(),
          reference: reference?.trim() || null,
          version,
          description: description?.trim() || null,
          contenu: contenu || null,
          fichierUrl: fichierUrl?.trim() || null,
          statut: statutFinal,
          dateEffet: dateEffet ? new Date(dateEffet) : null,
          creePar: parseInt(session.user.id),
          pointDeVenteId: pdvId,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "DocumentStrategiqueRH",
        entiteId: doc.id,
        details:  `Création ${type} v${version} — ${titre.trim()}`,
      },
    });

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/documents-strategiques", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
