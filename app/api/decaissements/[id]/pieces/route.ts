import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { SOURCE_PIECES_DECAISSEMENT } from "@/lib/ficheDecaissementServer";

type Ctx = { params: Promise<{ id: string }> };

const NATURES = ["FACTURE", "RECU", "BON_LIVRAISON", "CONTRAT", "AUTRE"] as const;
type Nature = (typeof NATURES)[number];

/** Accès : le demandeur de la fiche, le comptable/chef comptable et l'admin. */
async function autoriser(ficheId: number) {
  const session = await getAuthSession();
  if (!session) return { erreur: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  const fiche = await prisma.ficheDecaissement.findUnique({ where: { id: ficheId }, select: { id: true, reference: true, demandeurId: true } });
  if (!fiche) return { erreur: NextResponse.json({ error: "Fiche introuvable" }, { status: 404 }) };
  const privilegie = !!(await getComptableSession());
  if (!privilegie && fiche.demandeurId !== parseInt(session.user.id)) return { erreur: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  return { session, fiche };
}

/** GET /api/decaissements/[id]/pieces — pièces justificatives jointes à la fiche. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await autoriser(Number(id));
    if (a.erreur) return a.erreur;
    const pieces = await prisma.pieceJustificative.findMany({
      where: { sourceType: SOURCE_PIECES_DECAISSEMENT, sourceId: a.fiche!.id },
      select: { id: true, nom: true, url: true, nature: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ data: pieces });
  } catch (error) {
    console.error("GET /decaissements/[id]/pieces:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/decaissements/[id]/pieces
 * Body : { pieces: [{ nom, url, key, type, taille, nature? }] } — fichiers déjà téléversés (UploadThing).
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const a = await autoriser(Number(id));
    if (a.erreur) return a.erreur;
    const session = a.session!;
    const fiche = a.fiche!;

    const body = await req.json();
    const pieces = (Array.isArray(body.pieces) ? body.pieces : []).filter(
      (p: { url?: string; key?: string; nom?: string }) => p && p.url && p.key && p.nom,
    ) as { nom: string; url: string; key: string; type?: string; taille?: number; nature?: string }[];
    if (pieces.length === 0) return NextResponse.json({ error: "Aucune pièce fournie" }, { status: 400 });

    const userId = parseInt(session.user.id);
    const archiverJusquau = new Date();
    archiverJusquau.setFullYear(archiverJusquau.getFullYear() + 10);

    await prisma.$transaction(async (tx) => {
      await tx.pieceJustificative.createMany({
        data: pieces.map((p) => ({
          nom: p.nom, url: p.url, uploadthingKey: p.key, type: p.type || "application/octet-stream", taille: Number(p.taille) || 0,
          nature: ((NATURES as readonly string[]).includes(p.nature ?? "") ? p.nature : "AUTRE") as Nature,
          sourceType: SOURCE_PIECES_DECAISSEMENT, sourceId: fiche.id, uploadePar: userId, archiverJusquau,
        })),
      });
      await auditLog(tx, userId, "FD_PIECES_AJOUTEES", "FicheDecaissement", fiche.id, { nombre: pieces.length }, getRequestMeta(req));
      await notifyRoles(tx, ["COMPTABLE", "CHEF_COMPTABLE"], {
        titre: `Justificatifs reçus (${fiche.reference})`,
        message: `${session.user.prenom} ${session.user.nom} a joint ${pieces.length} pièce(s) justificative(s) à la fiche ${fiche.reference}.`,
        actionUrl: `/dashboard/user/decaissements?detail=${fiche.id}`,
      });
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("POST /decaissements/[id]/pieces:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
