import { NextResponse } from "next/server";
import { marquerStatutParProviderMessageId, marquerReponseParTelephone } from "@/lib/webhooksMarketing";

/**
 * POST /api/webhooks/twilio/statut?secret=MARKETING_WEBHOOK_SECRET
 * Callback Twilio (SMS + WhatsApp) — même URL sert pour les callbacks de statut
 * ("Status Callback URL") et pour les messages entrants ("A Message Comes In"),
 * Twilio POST les deux en application/x-www-form-urlencoded (CDC §24-25).
 *
 * Ne nécessite aucune clé payante en plus de celles déjà utilisées à l'envoi
 * (TWILIO_ACCOUNT_SID/AUTH_TOKEN) — si ces variables ne sont pas configurées,
 * cet endpoint reste inerte (aucun envoi n'a de providerMessageId à corréler).
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (process.env.MARKETING_WEBHOOK_SECRET && searchParams.get("secret") !== process.env.MARKETING_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const messageStatus = form.get("MessageStatus")?.toString(); // callback de statut
    const messageSid = (form.get("MessageSid") ?? form.get("SmsSid"))?.toString();
    const body = form.get("Body")?.toString();
    const from = form.get("From")?.toString(); // ex "whatsapp:+228..." ou "+228..."

    if (messageStatus && messageSid) {
      const statut =
        messageStatus === "delivered" ? "LIVRE"
        : messageStatus === "read" ? "LU"
        : messageStatus === "failed" || messageStatus === "undelivered" ? "ECHEC"
        : null;
      if (statut) await marquerStatutParProviderMessageId(messageSid, statut);
    } else if (body && from) {
      // Message entrant (réponse du client) — pas de statut, juste du texte.
      const canal = from.startsWith("whatsapp:") ? "WHATSAPP" : "SMS";
      const telephone = from.replace("whatsapp:", "");
      await marquerReponseParTelephone(telephone, canal);
    }

    // Twilio attend un 200 (TwiML vide accepté) pour ne pas retenter le webhook.
    return new NextResponse("<Response></Response>", { status: 200, headers: { "Content-Type": "text/xml" } });
  } catch (error) {
    console.error("Webhook Twilio erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
