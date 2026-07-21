import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/recrutement/documents?posteId= | candidatureId= [&archive=true]
 * Liste les documents de recrutement générés pour un poste OU une candidature.
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const posteId       = Number(searchParams.get("posteId")) || null;
  const candidatureId = Number(searchParams.get("candidatureId")) || null;
  const archive       = searchParams.get("archive") === "true";

  if (!posteId && !candidatureId) {
    return NextResponse.json({ error: "posteId ou candidatureId requis" }, { status: 400 });
  }

  const where: Prisma.DocumentRecrutementGenereWhereInput = {
    archive,
    ...(posteId ? { posteId } : {}),
    ...(candidatureId ? { candidatureId } : {}),
  };

  const data = await prisma.documentRecrutementGenere.findMany({
    where,
    orderBy: [{ type: "asc" }, { version: "desc" }],
    select: { id: true, type: true, titre: true, version: true, contenu: true, notes: true, archive: true, createdAt: true },
  });

  return NextResponse.json({ data });
}
