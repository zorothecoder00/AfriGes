import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { ajouterTagClient, retirerTagClient, ClientTagError } from "@/lib/clientTags";

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

    await ajouterTagClient(clientId, Number(tagId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ClientTagError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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

    await retirerTagClient(clientId, Number(tagId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/clients/[id]/tags:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
