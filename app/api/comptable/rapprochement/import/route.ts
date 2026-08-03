import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { parserReleveCsv, parserReleveXlsx, parserReleveOfx, importerLignesReleve } from "@/lib/comptabilite/rapprochementImport";

/**
 * POST /api/comptable/rapprochement/import
 * Body: { compteNumero, format?: "CSV"|"XLSX"|"OFX", contenu?, contenuCsv? }
 * - CSV/OFX : `contenu` (ou `contenuCsv` pour compat) est le texte brut du fichier.
 * - XLSX    : `contenu` est le fichier encodé en base64 (binaire).
 * Importe un relevé bancaire (CDC §19) — colonnes attendues (CSV/XLSX) : Date,
 * Libelle, Debit, Credit, Reference.
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { compteNumero, format, contenuCsv } = body as { compteNumero?: string; format?: string; contenuCsv?: string };
    const contenu = (body as { contenu?: string }).contenu ?? contenuCsv;
    if (!compteNumero || !contenu) {
      return NextResponse.json({ error: "compteNumero et contenu sont requis" }, { status: 400 });
    }

    const fmt = format ?? "CSV";
    const { lignes, erreurs } = await (async () => {
      if (fmt === "XLSX") return parserReleveXlsx(Buffer.from(contenu, "base64"));
      if (fmt === "OFX") return parserReleveOfx(contenu);
      return parserReleveCsv(contenu);
    })();

    if (lignes.length === 0) {
      return NextResponse.json({ error: "Aucune ligne valide dans le fichier", erreurs }, { status: 422 });
    }

    const userId = Number(session.user.id);
    const nbImportees = await prisma.$transaction((tx) => importerLignesReleve(tx, compteNumero, lignes, userId));

    return NextResponse.json({
      success: true,
      message: `${nbImportees} ligne(s) importée(s)${erreurs.length > 0 ? ` · ${erreurs.length} ignorée(s)` : ""}`,
      data: { nbImportees, erreurs },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
