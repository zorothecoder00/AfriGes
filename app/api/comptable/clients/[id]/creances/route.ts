import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

type Ctx = { params: Promise<{ id: string }> };

interface LigneCreance {
  type: "ECHEANCE_CREDIT" | "FACTURE";
  reference: string;
  dateEcheance: Date;
  montantDu: number;
  montantRestant: number;
  echue: boolean;
  joursRetard: number;
}

/**
 * GET /api/comptable/clients/[id]/creances
 * Créances échues / non échues (CDC Comptabilité §16) — état distinct de la
 * balance âgée (qui ventile par tranche d'ancienneté) : ici, simple partition
 * binaire par rapport à la date d'échéance de chaque échéance de crédit ou
 * facture non intégralement réglée du client.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    const maintenant = new Date();

    const [echeancesCredit, factures] = await Promise.all([
      prisma.echeanceCredit.findMany({
        where: { credit: { clientId }, statut: { in: ["EN_ATTENTE", "PARTIEL", "EN_RETARD"] } },
        select: { dateEcheance: true, montantDu: true, montantPaye: true, numeroEcheance: true, credit: { select: { reference: true } } },
      }),
      prisma.factureVente.findMany({
        where: { clientId, statut: "EMISE" },
        select: { dateEcheance: true, montantTTC: true, montantPaye: true, numero: true },
      }),
    ]);

    const lignes: LigneCreance[] = [];
    for (const e of echeancesCredit) {
      const restant = Number(e.montantDu) - Number(e.montantPaye);
      if (restant <= 0.01) continue;
      const echue = e.dateEcheance < maintenant;
      lignes.push({
        type: "ECHEANCE_CREDIT",
        reference: `${e.credit.reference} — éch. ${e.numeroEcheance}`,
        dateEcheance: e.dateEcheance,
        montantDu: Number(e.montantDu),
        montantRestant: restant,
        echue,
        joursRetard: echue ? Math.floor((maintenant.getTime() - e.dateEcheance.getTime()) / 86_400_000) : 0,
      });
    }
    for (const f of factures) {
      if (!f.dateEcheance) continue;
      const restant = Number(f.montantTTC) - Number(f.montantPaye);
      if (restant <= 0.01) continue;
      const echue = f.dateEcheance < maintenant;
      lignes.push({
        type: "FACTURE",
        reference: f.numero,
        dateEcheance: f.dateEcheance,
        montantDu: Number(f.montantTTC),
        montantRestant: restant,
        echue,
        joursRetard: echue ? Math.floor((maintenant.getTime() - f.dateEcheance.getTime()) / 86_400_000) : 0,
      });
    }

    lignes.sort((a, b) => a.dateEcheance.getTime() - b.dateEcheance.getTime());
    const echues = lignes.filter((l) => l.echue);
    const nonEchues = lignes.filter((l) => !l.echue);

    return NextResponse.json({
      data: {
        echues, nonEchues,
        totalEchues: echues.reduce((s, l) => s + l.montantRestant, 0),
        totalNonEchues: nonEchues.reduce((s, l) => s + l.montantRestant, 0),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
