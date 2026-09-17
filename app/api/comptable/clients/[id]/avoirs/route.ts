import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { ecritureAvoirClient } from "@/lib/comptabilite/moteur";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

/** Référence d'avoir, ex. "AV-2026-000001" — séquence propre à l'année civile. */
async function genererReferenceAvoir(): Promise<string> {
  const annee = new Date().getFullYear();
  const prefixe = `AV-${annee}-`;
  const count = await prisma.avoirClient.count({ where: { reference: { startsWith: prefixe } } });
  return `${prefixe}${String(count + 1).padStart(6, "0")}`;
}

/**
 * GET /api/comptable/clients/[id]/avoirs
 * Liste les avoirs d'un client (CDC Comptabilité §16).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const avoirs = await prisma.avoirClient.findMany({
      where: { clientId: Number(id) },
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
 * POST /api/comptable/clients/[id]/avoirs
 * Body: { montant, motif, notes?, reclamationId? }
 * Émet un avoir client — génère aussitôt l'écriture comptable inverse (CDC §16).
 * reclamationId (optionnel) rattache l'avoir à une réclamation (CDC §5.8) :
 * journalise une action "AVOIR_EMIS" et fait avancer son statut vers RESOLUE.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    const body = await req.json();
    const { montant, motif, notes, reclamationId } = body as {
      montant?: number; motif?: string; notes?: string; reclamationId?: number;
    };

    if (!montant || Number(montant) <= 0) return NextResponse.json({ error: "Le montant doit être positif" }, { status: 400 });
    if (!motif || !motif.trim()) return NextResponse.json({ error: "Le motif est obligatoire" }, { status: 400 });

    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, nom: true, prenom: true } });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    let reclamation: { id: number; statut: string } | null = null;
    if (reclamationId) {
      reclamation = await prisma.reclamationClient.findFirst({
        where: { id: Number(reclamationId), clientId },
        select: { id: true, statut: true },
      });
      if (!reclamation) return NextResponse.json({ error: "Réclamation introuvable pour ce client" }, { status: 404 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const reference = await genererReferenceAvoir();

    const avoir = await prisma.$transaction(async (tx) => {
      const ecritureId = await ecritureAvoirClient(tx, {
        montant: Number(montant),
        reference,
        clientNom: `${client.prenom} ${client.nom}`,
        clientId,
        userId,
      });

      const a = await tx.avoirClient.create({
        data: {
          reference, clientId, montant: Number(montant), motif: motif.trim(),
          notes: notes?.trim() || null, ecritureId, creeParId: userId,
          reclamationId: reclamation?.id ?? null,
        },
      });
      await auditLog(tx, userId, "EMISSION_AVOIR_CLIENT", "AvoirClient", a.id, { clientId, montant: Number(montant), reference }, meta);

      if (reclamation) {
        await tx.actionReclamation.create({
          data: {
            reclamationId: reclamation.id,
            type: "AVOIR_EMIS",
            description: `Avoir ${reference} émis (${Number(montant).toLocaleString("fr-FR")} FCFA) — ${motif.trim()}`,
            auteurId: userId,
          },
        });
        if (reclamation.statut === "ENREGISTREE" || reclamation.statut === "EN_TRAITEMENT") {
          await tx.reclamationClient.update({ where: { id: reclamation.id }, data: { statut: "RESOLUE" } });
        }
      }
      return a;
    });

    return NextResponse.json({ data: avoir }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
