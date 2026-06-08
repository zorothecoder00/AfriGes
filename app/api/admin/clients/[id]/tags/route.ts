import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/clients/[id]/tags
 * Tags actuellement associés à un client.
 * Accessible à tous les rôles admin (lecture).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const clientTags = await prisma.clientTag.findMany({
      where: { clientId },
      include: { tag: true },
      orderBy: { tag: { nom: "asc" } },
    });

    return NextResponse.json({ data: clientTags.map((ct) => ct.tag) });
  } catch (error) {
    console.error("GET /api/admin/clients/[id]/tags:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/clients/[id]/tags
 * Attacher un tag à un client.
 * Body: { tagId }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const { tagId } = await req.json();
    if (!tagId) return NextResponse.json({ error: "tagId obligatoire" }, { status: 400 });

    const [client, tag] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId }, select: { id: true, segment: true } }),
      prisma.tag.findUnique({ where: { id: Number(tagId) } }),
    ]);

    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    if (!tag)    return NextResponse.json({ error: "Tag introuvable" }, { status: 404 });
    if (!tag.actif) return NextResponse.json({ error: "Ce tag est inactif" }, { status: 400 });

    // Vérifier compatibilité segment
    if (tag.segment && tag.segment !== client.segment) {
      return NextResponse.json(
        { error: `Ce tag est réservé aux clients "${tag.segment}". Ce client est "${client.segment}".` },
        { status: 400 }
      );
    }

    // Upsert (silencieux si déjà associé)
    await prisma.clientTag.upsert({
      where: { clientId_tagId: { clientId, tagId: Number(tagId) } },
      update: {},
      create: { clientId, tagId: Number(tagId) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/admin/clients/[id]/tags:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/clients/[id]/tags
 * Détacher un tag d'un client.
 * Body: { tagId }
 */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const { tagId } = await req.json();
    if (!tagId) return NextResponse.json({ error: "tagId obligatoire" }, { status: 400 });

    await prisma.clientTag.deleteMany({
      where: { clientId, tagId: Number(tagId) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/clients/[id]/tags:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
