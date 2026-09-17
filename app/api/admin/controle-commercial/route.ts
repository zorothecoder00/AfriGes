import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/authAdmin";
import { prisma } from "@/lib/prisma";
import {
  calculerPlage, type Periode,
  rapportVentes, rapportVentesParAgent, rapportVentesParProduit, rapportVentesParAgence,
  rapportVentesCredit, rapportEncaissements, rapportImpayes, rapportRecouvrement,
  rapportRetours, rapportReclamations, rapportPerformances, tableauBordCommercial,
} from "@/lib/rapportsCommerciaux";

/**
 * Contrôle commercial & reporting (CDC digitalisation §5.9).
 * GET /api/admin/controle-commercial?vue=dashboard&periode=jour|semaine|mois&date=YYYY-MM-DD&pointDeVenteId=
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const vue = searchParams.get("vue") || "dashboard";
    const periode = (searchParams.get("periode") as Periode) || "jour";
    const dateRef = searchParams.get("date") ? new Date(searchParams.get("date")!) : new Date();
    const pointDeVenteId = searchParams.get("pointDeVenteId") ? Number(searchParams.get("pointDeVenteId")) : undefined;

    if (isNaN(dateRef.getTime())) return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    if (!["jour", "semaine", "mois"].includes(periode)) return NextResponse.json({ error: "Période invalide" }, { status: 400 });

    const { debut, fin } = calculerPlage(periode, dateRef);
    const f = { debut, fin, pointDeVenteId };

    const pdvs = await prisma.pointDeVente.findMany({ where: { actif: true }, select: { id: true, nom: true, code: true }, orderBy: { nom: "asc" } });

    let data: unknown;
    switch (vue) {
      case "ventes": data = await rapportVentes(f); break;
      case "agents": data = await rapportVentesParAgent(f); break;
      case "produits": data = await rapportVentesParProduit(f); break;
      case "agences": data = await rapportVentesParAgence(f); break;
      case "credit": data = await rapportVentesCredit(f); break;
      case "encaissements": data = await rapportEncaissements(f); break;
      case "impayes": data = await rapportImpayes(pointDeVenteId); break;
      case "recouvrement": data = await rapportRecouvrement(f); break;
      case "retours": data = await rapportRetours(f); break;
      case "reclamations": data = await rapportReclamations(f); break;
      case "performances": data = await rapportPerformances(f); break;
      case "dashboard": default: data = await tableauBordCommercial(f); break;
    }

    return NextResponse.json({ data, plage: { debut, fin }, pdvs });
  } catch (error) {
    console.error("GET /admin/controle-commercial:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
