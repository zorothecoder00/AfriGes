import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { parserReleveCsv, importerLignesReleve } from "@/lib/comptabilite/rapprochementImport";

/**
 * POST /api/comptable/rapprochement/import
 * Body: { compteNumero, contenuCsv }
 * Importe un relevé bancaire CSV (CDC §19) — colonnes attendues : Date, Libelle,
 * Debit, Credit, Reference.
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { compteNumero, contenuCsv } = body as { compteNumero?: string; contenuCsv?: string };
    if (!compteNumero || !contenuCsv) {
      return NextResponse.json({ error: "compteNumero et contenuCsv sont requis" }, { status: 400 });
    }

    const { lignes, erreurs } = parserReleveCsv(contenuCsv);
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
