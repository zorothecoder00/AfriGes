import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { parserImportCsv, confirmerImport } from "@/lib/comptabilite/importEcritures";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * POST /api/comptable/import-ecritures
 * Body: { csv }
 * Import effectif (CDC §47) — n'importe que les groupes d'écritures 100% valides ;
 * l'aperçu (/apercu) doit avoir été consulté au préalable côté UI.
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { csv } = body as { csv?: string };
    if (!csv) return NextResponse.json({ error: "csv requis" }, { status: 400 });

    const lignes = parserImportCsv(csv);
    if (lignes.length === 0) return NextResponse.json({ error: "Aucune ligne détectée" }, { status: 422 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const result = await prisma.$transaction(async (tx) => {
      const r = await confirmerImport(tx, lignes, userId);
      await auditLog(tx, userId, "IMPORT_ECRITURES", "EcritureComptable", undefined, { ecrituresCreees: r.ecrituresCreees, groupesIgnores: r.groupesIgnores.length }, meta);
      return r;
    });

    return NextResponse.json({
      success: true,
      message: `${result.ecrituresCreees} écriture(s) créée(s)${result.groupesIgnores.length > 0 ? ` · ${result.groupesIgnores.length} groupe(s) ignoré(s)` : ""}`,
      data: result,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
