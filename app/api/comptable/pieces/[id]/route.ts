// app/api/comptable/pieces/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/comptable/pieces/[id]
 *   → Supprime la pièce justificative (DB + UploadThing)
 *   Accès : COMPTABLE, ADMIN, SUPER_ADMIN
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const pieceId = Number(id);

    const piece = await prisma.pieceJustificative.findUnique({ where: { id: pieceId } });
    if (!piece) return NextResponse.json({ success: false, message: "Pièce introuvable" }, { status: 404 });

    // Supprimer le fichier sur UploadThing
    try {
      await utapi.deleteFiles([piece.uploadthingKey]);
    } catch (utErr) {
      console.warn("UploadThing delete warning:", utErr);
      // On continue même si UploadThing échoue (fichier peut-être déjà supprimé)
    }

    // Supprimer l'entrée en base
    await prisma.pieceJustificative.delete({ where: { id: pieceId } });

    return NextResponse.json({ success: true, message: "Pièce supprimée" });
  } catch (error) {
    console.error("PIECES DELETE ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
