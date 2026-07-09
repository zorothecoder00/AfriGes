import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { extraireMetaRequete } from "@/lib/compteCourant";
import { attribuerPointsFidelite, getFidelite } from "@/lib/fidelite";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/comptes-courants/[id]/fidelite/ajuster — capacité CREATE
 * Attribution manuelle de points (CDC §19.D) :
 *   type "BONUS"      → ajoute des points (geste commercial / régularité),
 *   type "DEPENSE"    → échange des points (cadeau, avantage), 400 si solde insuffisant,
 *   type "AJUSTEMENT" → correction (+/−).
 * body = { type, points (>0), motif }
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("CREATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const compteId = Number((await params).id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: { clientId: true, numeroCompte: true, libelle: true, client: { select: { prenom: true, nom: true } } },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const type = body?.type as "BONUS" | "DEPENSE" | "AJUSTEMENT" | undefined;
  const points = Number(body?.points);
  const motif = typeof body?.motif === "string" && body.motif.trim() ? body.motif.trim() : null;
  const signe = body?.signe === "-" ? -1 : 1; // uniquement pour AJUSTEMENT

  if (!type || !["BONUS", "DEPENSE", "AJUSTEMENT"].includes(type)) {
    return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  }
  if (!points || isNaN(points) || points <= 0) {
    return NextResponse.json({ error: "Nombre de points invalide" }, { status: 400 });
  }
  if (!motif) return NextResponse.json({ error: "Motif requis" }, { status: 400 });

  // Signe effectif : BONUS = +, DEPENSE = −, AJUSTEMENT = selon `signe`.
  const delta = type === "DEPENSE" ? -points : type === "AJUSTEMENT" ? signe * points : points;

  const userId = Number(session.user.id);
  const { ip, userAgent } = extraireMetaRequete(req);
  const clientNom = `${compte.client.prenom} ${compte.client.nom}`;

  try {
    await prisma.$transaction(async (tx) => {
      await attribuerPointsFidelite(tx, {
        clientId: compte.clientId, points: delta, type, motif, source: "MANUEL", creeParId: userId,
      });
      await auditLog(tx, userId, "AJUSTEMENT_FIDELITE", "CompteCourant", compteId, { type, points: delta, motif }, { ip, userAgent });
      await notifyAdmins(tx, {
        titre: "Points de fidélité — ajustement",
        message: `${delta > 0 ? "+" : ""}${delta} point(s) (${type.toLowerCase()}) pour ${compte.libelle ?? clientNom}. Motif : ${motif}.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "POINTS_INSUFFISANTS") {
      return NextResponse.json({ error: "Solde de points insuffisant" }, { status: 400 });
    }
    console.error("POST /api/comptes-courants/[id]/fidelite/ajuster", e);
    return NextResponse.json({ error: "Erreur lors de l'opération" }, { status: 500 });
  }

  const resume = await getFidelite(compte.clientId);
  return NextResponse.json({ data: resume }, { status: 201 });
}
