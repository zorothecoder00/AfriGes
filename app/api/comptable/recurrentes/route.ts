import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

/** GET /api/comptable/recurrentes — liste des écritures récurrentes (CDC §26). */
export async function GET() {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const recurrentes = await prisma.ecritureRecurrente.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ data: recurrentes });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/recurrentes
 * Body: { libelle, montant, compteDebitNumero, compteCreditNumero, journal,
 *         frequence?, dateDebut, dateFin?, nombreOccurrencesMax? }
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      libelle, montant, compteDebitNumero, compteCreditNumero, journal,
      frequence, dateDebut, dateFin, nombreOccurrencesMax,
    } = body;

    if (!libelle || montant == null || !compteDebitNumero || !compteCreditNumero || !journal || !dateDebut) {
      return NextResponse.json(
        { error: "libelle, montant, compteDebitNumero, compteCreditNumero, journal et dateDebut sont requis" },
        { status: 400 },
      );
    }

    const recurrente = await prisma.ecritureRecurrente.create({
      data: {
        libelle: String(libelle).trim(),
        montant: Number(montant),
        compteDebitNumero: String(compteDebitNumero).trim(),
        compteCreditNumero: String(compteCreditNumero).trim(),
        journal,
        frequence: frequence || "MENSUEL",
        dateDebut: new Date(dateDebut),
        dateFin: dateFin ? new Date(dateFin) : null,
        nombreOccurrencesMax: nombreOccurrencesMax ? Number(nombreOccurrencesMax) : null,
        userId: Number(session.user.id),
      },
    });
    return NextResponse.json({ data: recurrente }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
