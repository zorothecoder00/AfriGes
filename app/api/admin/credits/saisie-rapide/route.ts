import { NextResponse } from "next/server";
import { chargerCreditsAEncaisser, traiterBatchRemboursement, parseDateCollecte } from "@/lib/remboursementCredit";
import { scopeAdmin } from "@/lib/remboursementScope";

/** GET — crédits à encaisser. ?agentId= filtre sur les clients affectés à cet agent. */
export async function GET(req: Request) {
  const s = await scopeAdmin();
  if (!s.ok) return s.response;
  const agentId = new URL(req.url).searchParams.get("agentId");
  const data = await chargerCreditsAEncaisser(s.scope.where, agentId ? parseInt(agentId) : null);
  return NextResponse.json({ data });
}

/** POST — enregistrement groupé (saisie rapide). */
export async function POST(req: Request) {
  const s = await scopeAdmin();
  if (!s.ok) return s.response;
  try {
    const body = await req.json();
    const { lignes, agentCollecteurId, dateCollecte } = body;
    if (!Array.isArray(lignes) || lignes.length === 0) return NextResponse.json({ error: "Aucune ligne à enregistrer" }, { status: 400 });

    const result = await traiterBatchRemboursement({
      lignes: lignes.map((l: { creditId: unknown; numeroJour: unknown; montant: unknown; observation?: unknown }) => ({
        creditId:   Number(l.creditId),
        numeroJour: l.numeroJour != null && l.numeroJour !== "" ? parseInt(String(l.numeroJour)) : null,
        montant:    Number(l.montant) || 0,
        observation: l.observation != null ? String(l.observation) : null,
      })),
      scopeWhere:        s.scope.where,
      enregistreParId:   s.scope.userId,
      agentCollecteurId: agentCollecteurId ? parseInt(String(agentCollecteurId)) : s.scope.agentCollecteurDefault,
      confirmer:         s.scope.confirmer,
      dateCollecte:      parseDateCollecte(dateCollecte),
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/credits/saisie-rapide", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
