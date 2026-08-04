import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

/** Référence de litige, ex. "LIT-2026-000001" — séquence propre à l'année civile. */
async function genererReferenceLitige(): Promise<string> {
  const annee = new Date().getFullYear();
  const prefixe = `LIT-${annee}-`;
  const count = await prisma.litigeClient.count({ where: { reference: { startsWith: prefixe } } });
  return `${prefixe}${String(count + 1).padStart(6, "0")}`;
}

/**
 * GET /api/comptable/clients/[id]/litiges
 * Liste les litiges d'un client (CDC Comptabilité §16).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const litiges = await prisma.litigeClient.findMany({
      where: { clientId: Number(id) },
      include: { creePar: { select: { nom: true, prenom: true } } },
      orderBy: { dateOuverture: "desc" },
    });
    return NextResponse.json({ data: litiges });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/clients/[id]/litiges
 * Body: { motif, montantConteste?, notes? }
 * Ouvre un litige — suivi pur, ne génère aucune écriture (CDC §16).
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    const body = await req.json();
    const { motif, montantConteste, notes } = body as { motif?: string; montantConteste?: number; notes?: string };

    if (!motif || !motif.trim()) return NextResponse.json({ error: "Le motif est obligatoire" }, { status: 400 });

    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const reference = await genererReferenceLitige();

    const litige = await prisma.$transaction(async (tx) => {
      const l = await tx.litigeClient.create({
        data: {
          reference, clientId, motif: motif.trim(),
          montantConteste: montantConteste != null ? Number(montantConteste) : null,
          notes: notes?.trim() || null, creeParId: userId,
        },
      });
      await auditLog(tx, userId, "OUVERTURE_LITIGE_CLIENT", "LitigeClient", l.id, { clientId, motif: l.motif, reference }, meta);
      return l;
    });

    return NextResponse.json({ data: litige }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
