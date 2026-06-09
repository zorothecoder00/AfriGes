import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/documents-rh/historique?profilRHId=X
 * Retourne tous les documents (toutes versions, archivés inclus) d'un collaborateur,
 * groupés par type, triés par version décroissante.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const profilRHId = searchParams.get("profilRHId");

    if (!profilRHId) {
      return NextResponse.json({ error: "profilRHId est obligatoire" }, { status: 400 });
    }

    const profil = await prisma.profilRH.findUnique({
      where: { id: Number(profilRHId) },
      select: {
        id: true,
        matricule: true,
        gestionnaire: { select: { member: { select: { nom: true, prenom: true, photo: true } } } },
      },
    });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const documents = await prisma.documentRHGenere.findMany({
      where:   { profilRHId: Number(profilRHId) },
      orderBy: [{ type: "asc" }, { version: "desc" }],
      select: {
        id: true, type: true, titre: true, version: true,
        fileUrl: true, contenu: true, notes: true, archive: true,
        generePar: true, createdAt: true,
      },
    });

    // Grouper par type
    const grouped: Record<string, typeof documents> = {};
    for (const doc of documents) {
      if (!grouped[doc.type]) grouped[doc.type] = [];
      grouped[doc.type].push(doc);
    }

    return NextResponse.json({
      profil,
      grouped,
      total: documents.length,
    });
  } catch (error) {
    console.error("GET /api/admin/rh/documents-rh/historique", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
