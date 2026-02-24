import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET — Liste tous les packs (templates de configuration).
 * POST — Crée un nouveau pack.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const packs = await prisma.pack.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { souscriptions: true } },
      },
    });

    return NextResponse.json(packs);
  } catch (error) {
    console.error("GET /api/admin/packs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await req.json();
    const {
      nom,
      type,
      description,
      dureeJours,
      frequenceVersement,
      montantVersement,
      formuleRevendeur,
      montantCredit,
      montantSeuil,
      bonusPourcentage,
      cyclesBonusTrigger,
      acomptePercent,
      pointsParTranche,
      montantTranche,
    } = body;

    if (!nom || !type) {
      return NextResponse.json({ error: "Champs obligatoires : nom, type" }, { status: 400 });
    }

    // ── Validation et normalisation des règles métier par type ──────────────
    let dureeJoursVal   = dureeJours   ? parseInt(dureeJours)   : null;
    let freqVal         = frequenceVersement ?? "HEBDOMADAIRE";
    let acompteVal      = acomptePercent ? parseFloat(acomptePercent) : null;
    let bonusVal        = bonusPourcentage ? parseFloat(bonusPourcentage) : null;
    let cyclesVal       = cyclesBonusTrigger ? parseInt(cyclesBonusTrigger) : null;
    const formuleVal      = formuleRevendeur ?? null;
    const montantCreditVal = montantCredit ? parseFloat(montantCredit) : null;

    if (type === "ALIMENTAIRE") {
      if (!dureeJoursVal || ![15, 30].includes(dureeJoursVal)) {
        return NextResponse.json({ error: "Pack Alimentaire : durée doit être 15 ou 30 jours" }, { status: 400 });
      }
    }

    if (type === "REVENDEUR") {
      if (!formuleVal || !["FORMULE_1", "FORMULE_2"].includes(formuleVal)) {
        return NextResponse.json({ error: "Pack Revendeur : formule obligatoire (FORMULE_1 ou FORMULE_2)" }, { status: 400 });
      }
      if (!montantCreditVal || montantCreditVal <= 0) {
        return NextResponse.json({ error: "Pack Revendeur : prix du produit obligatoire" }, { status: 400 });
      }
      if (formuleVal === "FORMULE_1") {
        freqVal   = "HEBDOMADAIRE";
        acompteVal = 50;
      } else {
        freqVal        = "QUOTIDIEN";
        dureeJoursVal  = 16;
        acompteVal     = null;
      }
    }

    if (type === "FAMILIAL") {
      dureeJoursVal = 30;
      bonusVal      = 10;
      cyclesVal     = 3;
      if (!["HEBDOMADAIRE", "BIMENSUEL"].includes(freqVal)) {
        return NextResponse.json({ error: "Pack Familial : fréquence doit être HEBDOMADAIRE ou BIMENSUEL" }, { status: 400 });
      }
    }

    if (type === "URGENCE") {
      acompteVal = 25;
      freqVal    = "QUOTIDIEN";
      if (!dureeJoursVal || dureeJoursVal < 7 || dureeJoursVal > 10) {
        return NextResponse.json({ error: "Pack Urgence : durée doit être entre 7 et 10 jours" }, { status: 400 });
      }
    }

    if (type === "FIDELITE") {
      dureeJoursVal = null; // pas de durée
      freqVal = "HEBDOMADAIRE"; // valeur neutre (non utilisée)
    }
    // ────────────────────────────────────────────────────────────────────────

    const pack = await prisma.pack.create({
      data: {
        nom,
        type,
        description,
        dureeJours: dureeJoursVal,
        frequenceVersement: freqVal,
        montantVersement: montantVersement ? parseFloat(montantVersement) : null,
        formuleRevendeur: formuleVal,
        montantCredit: montantCreditVal,
        montantSeuil: montantSeuil ? parseFloat(montantSeuil) : null,
        bonusPourcentage: bonusVal,
        cyclesBonusTrigger: cyclesVal,
        acomptePercent: acompteVal,
        pointsParTranche: pointsParTranche ? parseInt(pointsParTranche) : null,
        montantTranche: montantTranche ? parseFloat(montantTranche) : null,
      },
    });

    return NextResponse.json(pack, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/packs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
