/**
 * Abstraction d'envoi SMS.
 *
 * Fournisseurs supportés :
 *   - Africa's Talking (défaut, populaire en Afrique subsaharienne)
 *   - Twilio
 *
 * Variables d'environnement :
 *   SMS_ENABLED=true                  (désactivé par défaut)
 *   SMS_PROVIDER=africas_talking|twilio
 *
 *   Africa's Talking :
 *     AT_API_KEY, AT_USERNAME, AT_SENDER_ID (optionnel)
 *
 *   Twilio :
 *     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM
 */

import { normalizePhone } from "@/lib/phone";

async function sendViaAfricasTalking(to: string, message: string): Promise<boolean> {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;
  if (!apiKey || !username) {
    console.warn("[SMS] Africa's Talking : AT_API_KEY / AT_USERNAME manquants");
    return false;
  }

  const body = new URLSearchParams({ username, to, message });
  if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);

  const res = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    console.error("[SMS] Africa's Talking erreur :", await res.text());
    return false;
  }
  return true;
}

async function sendViaTwilioSMS(to: string, message: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;
  if (!sid || !token || !from) {
    console.warn("[SMS] Twilio : variables d'env manquantes");
    return false;
  }

  const body = new URLSearchParams({ To: to, From: from, Body: message });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    console.error("[SMS] Twilio erreur :", await res.text());
    return false;
  }
  return true;
}

/**
 * Envoie un SMS au numéro donné.
 * Retourne true si l'envoi a réussi, false sinon (échec non-bloquant).
 */
export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (process.env.SMS_ENABLED !== "true") return false;

  const phone = normalizePhone(to);
  if (!phone) {
    console.warn(`[SMS] Numéro invalide : ${to}`);
    return false;
  }

  const provider = process.env.SMS_PROVIDER ?? "africas_talking";
  try {
    if (provider === "twilio") return await sendViaTwilioSMS(phone, message);
    return await sendViaAfricasTalking(phone, message);
  } catch (err) {
    console.error("[SMS] Erreur inattendue :", err);
    return false;
  }
}
