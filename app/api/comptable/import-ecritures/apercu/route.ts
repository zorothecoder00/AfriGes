import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { parserImportCsv, parserImportXlsx, previsualiserImport } from "@/lib/comptabilite/importEcritures";

/**
 * POST /api/comptable/import-ecritures/apercu
 * Body: { csv } (rétrocompat) ou { format: "CSV"|"XLSX", contenu } — XLSX en base64.
 * Aperçu de validation avant import (CDC §47) — ne modifie rien en base.
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { csv, format, contenu } = body as { csv?: string; format?: string; contenu?: string };
    const source = contenu ?? csv;
    if (!source) return NextResponse.json({ error: "contenu requis" }, { status: 400 });

    const lignes = format === "XLSX" ? await parserImportXlsx(Buffer.from(source, "base64")) : parserImportCsv(source);
    if (lignes.length === 0) return NextResponse.json({ error: "Aucune ligne détectée" }, { status: 422 });

    const apercu = await previsualiserImport(prisma, lignes);
    return NextResponse.json({ data: apercu });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
