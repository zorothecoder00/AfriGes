/**
 * Abstraction d'envoi WhatsApp.
 *
 * Fournisseurs supportés :
 *   - Twilio WhatsApp (défaut)
 *   - Meta Cloud API (WhatsApp Business Platform)
 *
 * Variables d'environnement :
 *   WA_ENABLED=true                 (désactivé par défaut)
 *   WA_PROVIDER=twilio|meta
 *
 *   Twilio WhatsApp :
 *     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *     TWILIO_WA_FROM  (numéro sandbox ou approuvé, ex: +14155238886)
 *
 *   Meta Cloud API :
 *     META_WA_TOKEN     (Bearer token d'accès permanent)
 *     META_WA_PHONE_ID  (Phone Number ID du compte WA Business)
 */

import { normalizePhone } from "@/lib/phone";
import type { ResultatEnvoiProvider } from "@/lib/sms";

async function sendViaTwilioWA(to: string, message: string): Promise<ResultatEnvoiProvider> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WA_FROM;
  if (!sid || !token || !from) {
    console.warn("[WA] Twilio : TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WA_FROM manquants");
    return { ok: false };
  }

  const body = new URLSearchParams({
    To:   `whatsapp:${to}`,
    From: `whatsapp:${from}`,
    Body: message,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    console.error("[WA] Twilio erreur :", await res.text());
    return { ok: false };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, providerMessageId: data?.sid };
}

async function sendViaMetaWA(to: string, message: string): Promise<ResultatEnvoiProvider> {
  const token   = process.env.META_WA_TOKEN;
  const phoneId = process.env.META_WA_PHONE_ID;
  if (!token || !phoneId) {
    console.warn("[WA] Meta : META_WA_TOKEN / META_WA_PHONE_ID manquants");
    return { ok: false };
  }

  // Meta attend le numéro sans le + (ex: 22890123456)
  const toMeta = to.replace(/^\+/, "");

  const res = await fetch(
    `https://graph.facebook.com/v18.0/${phoneId}/messages`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to:   toMeta,
        type: "text",
        text: { body: message },
      }),
    }
  );

  if (!res.ok) {
    console.error("[WA] Meta erreur :", await res.text());
    return { ok: false };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, providerMessageId: data?.messages?.[0]?.id };
}

/**
 * Envoie un message WhatsApp au numéro donné.
 * Retourne { ok, providerMessageId? } — providerMessageId sert à corréler le
 * webhook de statut (livré/lu/échec/réponse) reçu ultérieurement du fournisseur.
 */
export async function sendWhatsApp(to: string, message: string): Promise<ResultatEnvoiProvider> {
  if (process.env.WA_ENABLED !== "true") return { ok: false };

  const phone = normalizePhone(to);
  if (!phone) {
    console.warn(`[WA] Numéro invalide : ${to}`);
    return { ok: false };
  }

  const provider = process.env.WA_PROVIDER ?? "twilio";
  try {
    if (provider === "meta") return await sendViaMetaWA(phone, message);
    return await sendViaTwilioWA(phone, message);
  } catch (err) {
    console.error("[WA] Erreur inattendue :", err);
    return { ok: false };
  }
}
