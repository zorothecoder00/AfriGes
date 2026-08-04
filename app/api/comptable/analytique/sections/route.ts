import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { synchroniserSectionsDepartements } from "@/lib/comptabilite/analytique";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * GET /api/comptable/analytique/sections?axe=ACTIVITE|PROJET|DEPARTEMENT
 * Liste les sections analytiques (CDC §24, axes sans entité métier dédiée).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const axe = req.nextUrl.searchParams.get("axe");
    const sections = await prisma.sectionAnalytique.findMany({
      where: axe ? { axe: axe as never } : {},
      orderBy: [{ axe: "asc" }, { libelle: "asc" }],
    });
    return NextResponse.json({ data: sections });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/analytique/sections
 * Body: { axe, code, libelle } — ou { action: "synchroniser_departements" }
 * (CDC §24 : "que la création des départements puisse être automatique" —
 * crée les SectionAnalytique(axe=DEPARTEMENT) manquantes depuis ProfilRH.departement).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();

    if (body?.action === "synchroniser_departements") {
      const userId = Number(session.user.id);
      const meta = getRequestMeta(req);
      const result = await prisma.$transaction(async (tx) => {
        const r = await synchroniserSectionsDepartements(tx);
        if (r.crees.length > 0) {
          await auditLog(tx, userId, "SYNCHRONISATION_DEPARTEMENTS_ANALYTIQUES", "SectionAnalytique", undefined, { crees: r.crees }, meta);
        }
        return r;
      });
      return NextResponse.json({ data: result });
    }

    const { axe, code, libelle } = body as { axe?: string; code?: string; libelle?: string };
    if (!axe || !code || !libelle) {
      return NextResponse.json({ error: "axe, code et libelle sont requis" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const section = await prisma.$transaction(async (tx) => {
      const s = await tx.sectionAnalytique.create({
        data: { axe: axe as never, code: code.trim(), libelle: libelle.trim() },
      });
      await auditLog(tx, userId, "CREATION_SECTION_ANALYTIQUE", "SectionAnalytique", s.id, { axe, code: s.code, libelle: s.libelle }, meta);
      return s;
    });
    return NextResponse.json({ data: section }, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ce code existe déjà" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
