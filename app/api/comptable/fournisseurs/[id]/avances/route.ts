import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { ecritureAvanceFournisseur } from "@/lib/comptabilite/moteur";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

/** Référence d'avance fournisseur, ex. "ACF-2026-000001" — séquence propre à l'année civile. */
async function genererReferenceAvance(): Promise<string> {
  const annee = new Date().getFullYear();
  const prefixe = `ACF-${annee}-`;
  const count = await prisma.avanceFournisseur.count({ where: { reference: { startsWith: prefixe } } });
  return `${prefixe}${String(count + 1).padStart(6, "0")}`;
}

/**
 * GET /api/comptable/fournisseurs/[id]/avances
 * Liste les avances/acomptes versés à un fournisseur (CDC Comptabilité §17).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const avances = await prisma.avanceFournisseur.findMany({
      where: { fournisseurId: Number(id) },
      include: { creePar: { select: { nom: true, prenom: true } } },
      orderBy: { dateVersement: "desc" },
    });
    return NextResponse.json({ data: avances });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/fournisseurs/[id]/avances
 * Body: { montant, modePaiement?, notes? }
 * Verse une avance — Dr 402 / Cr Trésorerie (CDC §17).
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fournisseurId = Number(id);
    const body = await req.json();
    const { montant, modePaiement, notes } = body as { montant?: number; modePaiement?: string; notes?: string };

    if (!montant || Number(montant) <= 0) return NextResponse.json({ error: "Le montant doit être positif" }, { status: 400 });

    const fournisseur = await prisma.fournisseur.findUnique({ where: { id: fournisseurId }, select: { id: true, nom: true } });
    if (!fournisseur) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const reference = await genererReferenceAvance();

    const avance = await prisma.$transaction(async (tx) => {
      const ecritureId = await ecritureAvanceFournisseur(tx, {
        montant: Number(montant), reference, fournisseurNom: fournisseur.nom, modePaiement, userId,
      });

      const a = await tx.avanceFournisseur.create({
        data: {
          reference, fournisseurId, montant: Number(montant), modePaiement: modePaiement || null,
          notes: notes?.trim() || null, ecritureId, creeParId: userId,
        },
      });
      await auditLog(tx, userId, "VERSEMENT_AVANCE_FOURNISSEUR", "AvanceFournisseur", a.id, { fournisseurId, montant: Number(montant), reference }, meta);
      return a;
    });

    return NextResponse.json({ data: avance }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
