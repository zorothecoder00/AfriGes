import { NextResponse } from "next/server";
import { chargerCreditsAEncaisser, traiterBatchRemboursement, parseDateCollecte } from "@/lib/remboursementCredit";
import { scopeAgentTerrain } from "@/lib/remboursementScope";

/** GET — clients/crédits à encaisser affectés à l'agent. */
export async function GET() {
  const s = await scopeAgentTerrain();
  if (!s.ok) return s.response;
  const data = await chargerCreditsAEncaisser(s.scope.where);
  return NextResponse.json({ data });
}

/** POST — enregistrement groupé (saisie rapide) → en attente confirmation caissier. */
export async function POST(req: Request) {
  const s = await scopeAgentTerrain();
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
      // Agent terrain : collecteur = lui-même par défaut
      agentCollecteurId: agentCollecteurId ? parseInt(String(agentCollecteurId)) : s.scope.agentCollecteurDefault,
      confirmer:         s.scope.confirmer,
      dateCollecte:      parseDateCollecte(dateCollecte),
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/agentTerrain/credits/saisie-rapide", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
