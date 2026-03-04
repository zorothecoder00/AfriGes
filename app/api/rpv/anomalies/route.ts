import { NextResponse } from "next/server";
import { TypeAnomalie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { notifyAdmins, auditLog } from "@/lib/notifications";
import { randomUUID } from "crypto";

/**
 * POST /api/rpv/anomalies
 * Signaler un produit endommagé ou perdu par le RPV.
 * Body: { produitId, type: "MANQUANT"|"SURPLUS"|"DEFECTUEUX", quantite, description }
 */
export async function POST(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { produitId, type, quantite, description } = await req.json();

    if (!produitId || !type || !quantite || !description) {
      return NextResponse.json(
        { error: "Champs obligatoires : produitId, type, quantite, description" },
        { status: 400 }
      );
    }

    if (!["MANQUANT", "SURPLUS", "DEFECTUEUX"].includes(type)) {
      return NextResponse.json({ error: "Type invalide (MANQUANT, SURPLUS ou DEFECTUEUX)" }, { status: 400 });
    }

    const produit = await prisma.produit.findUnique({ where: { id: Number(produitId) } });
    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const rpvNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const anomalie = await prisma.$transaction(async (tx) => {
      const a = await tx.anomalieStock.create({
        data: {
          reference:   `RPV-ANO-${randomUUID().slice(0, 8).toUpperCase()}`,
          produitId:   Number(produitId),
          type:        type as TypeAnomalie,
          quantite:    Number(quantite),
          description,
          signalePar:  parseInt(session.user.id),
        },
        include: {
          produit:    { select: { id: true, nom: true } },
          magasinier: { select: { nom: true, prenom: true } },
        },
      });

      await notifyAdmins(tx, {
        titre:    `Anomalie signalée par RPV — ${produit.nom}`,
        message:  `${rpvNom} a signalé une anomalie (${type}) sur "${produit.nom}" : ${description} (qté: ${quantite})`,
        priorite: "HAUTE",
        actionUrl: "/dashboard/user/responsablesPointDeVente",
      });

      await auditLog(tx, parseInt(session.user.id), "ANOMALIE_SIGNALEE_RPV", "AnomalieStock", a.id);

      return a;
    });

    return NextResponse.json({ success: true, data: anomalie }, { status: 201 });
  } catch (error) {
    console.error("POST /api/rpv/anomalies", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
