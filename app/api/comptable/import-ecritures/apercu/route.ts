import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { parserImportCsv, previsualiserImport } from "@/lib/comptabilite/importEcritures";

/**
 * POST /api/comptable/import-ecritures/apercu
 * Body: { csv }
 * Aperçu de validation avant import (CDC §47) — ne modifie rien en base.
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

    const apercu = await previsualiserImport(prisma, lignes);
    return NextResponse.json({ data: apercu });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
