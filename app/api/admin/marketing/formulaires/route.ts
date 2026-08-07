import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import type { ChampFormulaire } from "@/lib/formulaireMarketing";

/**
 * Form builder marketing (CDC §45) — champs dynamiques.
 * GET  — liste des formulaires.
 * POST — crée un formulaire ({cle,label,type,requis}[]).
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const formulaires = await prisma.formulaireMarketing.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        campagne: { select: { id: true, code: true, nom: true } },
        _count: { select: { soumissions: true } },
      },
    });

    return NextResponse.json({ data: formulaires });
  } catch (e) {
    console.error("GET /api/admin/marketing/formulaires", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

const TYPES_CHAMP = ["text", "tel", "email", "select"];

export async function POST(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const { nom, campagneId, champs, actif } = body;

    const nomTrim = typeof nom === "string" ? nom.trim() : "";
    if (!nomTrim) return NextResponse.json({ error: "Le nom du formulaire est requis" }, { status: 400 });

    if (!Array.isArray(champs) || champs.length === 0) {
      return NextResponse.json({ error: "Au moins un champ est requis" }, { status: 400 });
    }
    const champsValides: ChampFormulaire[] = [];
    for (const c of champs as Record<string, unknown>[]) {
      const cle = typeof c.cle === "string" ? c.cle.trim() : "";
      const label = typeof c.label === "string" ? c.label.trim() : "";
      if (!cle || !label || !TYPES_CHAMP.includes(String(c.type))) {
        return NextResponse.json({ error: "Champ de formulaire invalide (cle/label/type requis)" }, { status: 400 });
      }
      champsValides.push({ cle, label, type: c.type as ChampFormulaire["type"], requis: !!c.requis, options: Array.isArray(c.options) ? c.options.map(String) : undefined });
    }
    if (!champsValides.some((c) => c.cle === "telephone")) {
      return NextResponse.json({ error: "Le formulaire doit inclure un champ 'telephone' (requis pour créer le client)" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const formulaire = await prisma.$transaction(async (tx) => {
      const f = await tx.formulaireMarketing.create({
        data: {
          nom: nomTrim, campagneId: campagneId ? Number(campagneId) : null,
          champs: champsValides as unknown as Prisma.InputJsonValue, actif: actif === undefined ? true : Boolean(actif),
          creeParId: userId,
        },
      });
      await auditLog(tx, userId, "FORMULAIRE_CREE", "FormulaireMarketing", f.id);
      return f;
    });

    return NextResponse.json({ data: formulaire }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/formulaires", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
