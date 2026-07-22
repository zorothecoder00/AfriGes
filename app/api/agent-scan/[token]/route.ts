import { NextResponse } from "next/server";
import { donneesScanAgent } from "@/lib/agentScan";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/**
 * GET /api/agent-scan/[token]?date=YYYY-MM-DD  (PUBLIC — aucune authentification)
 * Le jeton opaque de l'URL fait office de clé. Renvoie les objectifs du jour +
 * les clients à visiter de l'agent, ou 404 si le jeton est inconnu/révoqué.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { token } = await params;
  const date = new URL(req.url).searchParams.get("date") ?? undefined;
  const data = await donneesScanAgent(token, date);
  if (!data) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });
  return NextResponse.json({ data });
}
