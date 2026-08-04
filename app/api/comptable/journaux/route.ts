import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { JOURNAUX_BUILTIN } from "@/lib/comptabilite/moteur";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

const LIBELLES_BUILTIN: Record<string, string> = {
  CAISSE: "Caisse", BANQUE: "Banque", VENTES: "Ventes",
  ACHATS: "Achats", OD: "Opérations diverses", PAIE: "Paie",
  IMMOBILISATIONS: "Immobilisations", CLOTURE: "Clôture",
  OUVERTURE: "Opérations d'ouverture", REGULARISATION: "Régularisation",
};

// Codes courts CDC §9 (JVE/JAC/...) — purement d'affichage : le code interne
// (clé JOURNAUX_BUILTIN, stocké tel quel sur EcritureComptable.journal depuis
// le début du projet) n'est jamais renommé, pour ne pas casser l'historique ni
// les nombreux `journal: "VENTES"` câblés dans le code.
const CODES_COURTS_BUILTIN: Record<string, string> = {
  VENTES: "JVE", ACHATS: "JAC", BANQUE: "JBN", CAISSE: "JCA", OD: "JOD",
  PAIE: "JPA", IMMOBILISATIONS: "JIM", OUVERTURE: "JOU", CLOTURE: "JCL", REGULARISATION: "JRV",
};

/**
 * GET /api/comptable/journaux
 * Journaux builtin (toujours disponibles) + journaux personnalisés créés par
 * l'administrateur (CDC §9 : "l'administrateur doit pouvoir créer d'autres journaux").
 */
export async function GET() {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const personnalises = await prisma.journalComptable.findMany({ orderBy: { code: "asc" } });

    const builtins = JOURNAUX_BUILTIN.map((code) => ({
      id: null, code, libelle: LIBELLES_BUILTIN[code] ?? code, codeCourt: CODES_COURTS_BUILTIN[code] ?? code, prefixe: null, actif: true, builtin: true,
    }));

    return NextResponse.json({
      data: [...builtins, ...personnalises.map((j) => ({ ...j, builtin: false }))],
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/journaux
 * Body: { code, libelle, prefixe }
 * Crée un journal personnalisé.
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { code, libelle, prefixe } = body as { code?: string; libelle?: string; prefixe?: string };
    if (!code || !libelle || !prefixe) {
      return NextResponse.json({ error: "code, libelle et prefixe sont requis" }, { status: 400 });
    }

    const codeNorm = code.trim().toUpperCase();
    if ((JOURNAUX_BUILTIN as readonly string[]).includes(codeNorm)) {
      return NextResponse.json({ error: `"${codeNorm}" est déjà un journal de base` }, { status: 409 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const journal = await prisma.$transaction(async (tx) => {
      const j = await tx.journalComptable.create({
        data: { code: codeNorm, libelle: libelle.trim(), prefixe: prefixe.trim().slice(0, 2).toUpperCase() },
      });
      await auditLog(tx, userId, "CREATION_JOURNAL_COMPTABLE", "JournalComptable", j.id, { code: j.code, libelle: j.libelle }, meta);
      return j;
    });
    return NextResponse.json({ data: journal }, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ce code de journal existe déjà" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
