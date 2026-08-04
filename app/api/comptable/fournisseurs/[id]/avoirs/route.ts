import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { ecritureAvoirFournisseur } from "@/lib/comptabilite/moteur";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

/** Référence d'avoir fournisseur, ex. "AVF-2026-000001" — séquence propre à l'année civile. */
async function genererReferenceAvoirFournisseur(): Promise<string> {
  const annee = new Date().getFullYear();
  const prefixe = `AVF-${annee}-`;
  const count = await prisma.avoirFournisseur.count({ where: { reference: { startsWith: prefixe } } });
  return `${prefixe}${String(count + 1).padStart(6, "0")}`;
}

/**
 * GET /api/comptable/fournisseurs/[id]/avoirs
 * Liste les avoirs reçus d'un fournisseur (CDC Comptabilité §17).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const avoirs = await prisma.avoirFournisseur.findMany({
      where: { fournisseurId: Number(id) },
      include: { creePar: { select: { nom: true, prenom: true } } },
      orderBy: { dateEmission: "desc" },
    });
    return NextResponse.json({ data: avoirs });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/fournisseurs/[id]/avoirs
 * Body: { montant, motif, notes? }
 * Enregistre un avoir reçu — génère aussitôt l'écriture comptable inverse (CDC §17).
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fournisseurId = Number(id);
    const body = await req.json();
    const { montant, motif, notes } = body as { montant?: number; motif?: string; notes?: string };

    if (!montant || Number(montant) <= 0) return NextResponse.json({ error: "Le montant doit être positif" }, { status: 400 });
    if (!motif || !motif.trim()) return NextResponse.json({ error: "Le motif est obligatoire" }, { status: 400 });

    const fournisseur = await prisma.fournisseur.findUnique({ where: { id: fournisseurId }, select: { id: true, nom: true } });
    if (!fournisseur) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const reference = await genererReferenceAvoirFournisseur();

    const avoir = await prisma.$transaction(async (tx) => {
      const ecritureId = await ecritureAvoirFournisseur(tx, {
        montant: Number(montant), reference, fournisseurNom: fournisseur.nom, fournisseurId, userId,
      });

      const a = await tx.avoirFournisseur.create({
        data: {
          reference, fournisseurId, montant: Number(montant), motif: motif.trim(),
          notes: notes?.trim() || null, ecritureId, creeParId: userId,
        },
      });
      await auditLog(tx, userId, "ENREGISTREMENT_AVOIR_FOURNISSEUR", "AvoirFournisseur", a.id, { fournisseurId, montant: Number(montant), reference }, meta);
      return a;
    });

    return NextResponse.json({ data: avoir }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
