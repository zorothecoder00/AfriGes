import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { parserImportCsv, parserImportXlsx, confirmerImport } from "@/lib/comptabilite/importEcritures";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * POST /api/comptable/import-ecritures
 * Body: { csv } (rétrocompat) ou { format: "CSV"|"XLSX", contenu, forcerImportPartiel? }.
 * Import effectif (CDC §47) — n'importe que les groupes d'écritures 100% valides ;
 * bloqué en bloc tant qu'il reste des groupes en erreur, sauf `forcerImportPartiel`.
 * L'aperçu (/apercu) doit avoir été consulté au préalable côté UI.
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { csv, format, contenu, forcerImportPartiel } = body as { csv?: string; format?: string; contenu?: string; forcerImportPartiel?: boolean };
    const source = contenu ?? csv;
    if (!source) return NextResponse.json({ error: "contenu requis" }, { status: 400 });

    const lignes = format === "XLSX" ? await parserImportXlsx(Buffer.from(source, "base64")) : parserImportCsv(source);
    if (lignes.length === 0) return NextResponse.json({ error: "Aucune ligne détectée" }, { status: 422 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const result = await prisma.$transaction(async (tx) => {
      const r = await confirmerImport(tx, lignes, userId, { forcerImportPartiel });
      await auditLog(tx, userId, "IMPORT_ECRITURES", "EcritureComptable", undefined, { ecrituresCreees: r.ecrituresCreees, groupesIgnores: r.groupesIgnores.length, bloque: r.bloque ?? false }, meta);
      return r;
    });

    if (result.bloque) {
      return NextResponse.json({
        error: `Import bloqué : ${result.groupesIgnores.length} groupe(s) en erreur — corrigez le fichier ou forcez un import partiel`,
        data: result,
      }, { status: 422 });
    }

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
