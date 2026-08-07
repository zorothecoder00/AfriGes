import { NextResponse } from "next/server";
import { marquerStatutParProviderMessageId, marquerReponseParTelephone } from "@/lib/webhooksMarketing";

/**
 * GET /api/webhooks/meta/whatsapp — vérification d'abonnement du webhook Meta
 * (échange de "challenge", exigé par Meta pour activer l'URL). META_WA_VERIFY_TOKEN
 * est une chaîne choisie librement par nous (pas une clé payante) — CDC §24.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.META_WA_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST /api/webhooks/meta/whatsapp — statuts (sent/delivered/read/failed) et
 * messages entrants du WhatsApp Business Cloud API (CDC §24 statut/réception).
 * Reste inerte si META_WA_TOKEN/META_WA_PHONE_ID ne sont pas configurés à
 * l'envoi (aucun providerMessageId ne peut alors exister).
 */
export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const changes = payload?.entry?.flatMap((e: { changes?: unknown[] }) => e.changes ?? []) ?? [];

    for (const change of changes) {
      const value = change?.value ?? {};

      for (const s of value.statuses ?? []) {
        const statut =
          s.status === "delivered" ? "LIVRE"
          : s.status === "read" ? "LU"
          : s.status === "failed" ? "ECHEC"
          : null;
        if (statut && s.id) await marquerStatutParProviderMessageId(s.id, statut);
      }

      for (const m of value.messages ?? []) {
        if (m.from) await marquerReponseParTelephone(m.from, "WHATSAPP");
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook Meta WhatsApp erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
