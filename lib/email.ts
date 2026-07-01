/**
 * lib/email.ts — Envoi d'emails transactionnels, mutualisé.
 *
 * Fournisseur : Resend (API HTTP — https://resend.com), appelée directement
 * via fetch pour rester cohérent avec lib/sms.ts et lib/whatsapp.ts (aucune
 * dépendance npm supplémentaire à installer).
 *
 * Envoie vers n'importe quelle boîte mail (Gmail, Outlook, mail pro…).
 * L'envoi est TOUJOURS non-bloquant : en cas d'échec on log et on renvoie
 * false, jamais d'exception qui casserait la mutation appelante.
 *
 * Variables d'environnement :
 *   EMAIL_ENABLED=true                 (désactivé par défaut)
 *   RESEND_API_KEY=re_xxxxxxxx
 *   EMAIL_FROM="AfriGes <no-reply@afriges.com>"   (domaine vérifié requis en prod)
 *   EMAIL_REPLY_TO=support@afriges.com            (optionnel)
 *   NEXTAUTH_URL / APP_URL             (pour les liens dans les emails)
 *
 * NB : sans domaine vérifié chez Resend, l'envoi n'est possible que vers
 * votre propre adresse (mode test). Configurez SPF/DKIM pour la production.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** URL publique de l'application, pour construire des liens absolus. */
export function appUrl(): string {
  return (
    process.env.NEXTAUTH_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export interface EmailAttachment {
  filename: string;
  /** Contenu binaire (Buffer) ou déjà encodé en base64 (string). */
  content: Buffer | string;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  /** Version texte brut (fallback). Générée depuis le HTML si absente. */
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

/** Retire grossièrement les balises HTML pour produire un fallback texte. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>(?=)/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Envoie un email via Resend.
 * Retourne true si l'envoi a réussi, false sinon (échec non-bloquant).
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  if (process.env.EMAIL_ENABLED !== "true") return false;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[EMAIL] RESEND_API_KEY / EMAIL_FROM manquants");
    return false;
  }

  const replyTo = params.replyTo ?? process.env.EMAIL_REPLY_TO;

  const payload: Record<string, unknown> = {
    from,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text ?? htmlToText(params.html),
    ...(replyTo && { reply_to: replyTo }),
    ...(params.attachments?.length && {
      attachments: params.attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.isBuffer(a.content)
          ? a.content.toString("base64")
          : a.content,
      })),
    }),
  };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("[EMAIL] Resend erreur :", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[EMAIL] Erreur inattendue :", err);
    return false;
  }
}

// ─── Gabarits ──────────────────────────────────────────────────────────────

/** Échappe le HTML pour insertion sûre dans un gabarit. */
function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Enveloppe un contenu HTML dans une mise en page email brandée AfriGes.
 * Styles inline uniquement (compatibilité clients mail).
 */
export function renderEmailLayout(bodyHtml: string, title = "AfriGes"): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">AfriGes</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-size:15px;line-height:1.6;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
            Cet email vous a été envoyé automatiquement par AfriGes. Merci de ne pas y répondre directement.<br/>
            © ${year} AfriGes — Tous droits réservés.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Bouton d'action réutilisable dans les emails. */
function emailButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="border-radius:8px;background:#0f172a;">
      <a href="${esc(href)}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">${esc(label)}</a>
    </td></tr>
  </table>`;
}

export interface WelcomeEmailParams {
  to: string;
  prenom: string;
  nom: string;
  /** Email de connexion (identifiant). */
  email: string;
  /** Mot de passe initial en clair, si créé par l'admin (optionnel). */
  motDePasse?: string;
  /** Libellé de rôle à afficher (optionnel). */
  role?: string;
}

/**
 * Envoie l'email de bienvenue à un utilisateur nouvellement créé.
 * Non-bloquant : retourne false sans lever d'exception en cas d'échec.
 */
export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<boolean> {
  const loginUrl = `${appUrl()}/login`;

  const identifiants = params.motDePasse
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
         <tr><td style="padding:16px 20px;">
           <div style="font-size:13px;color:#64748b;margin-bottom:8px;">Vos identifiants de connexion :</div>
           <div style="font-size:14px;"><strong>Identifiant :</strong> ${esc(params.email)}</div>
           <div style="font-size:14px;margin-top:4px;"><strong>Mot de passe :</strong> ${esc(params.motDePasse)}</div>
           <div style="font-size:12px;color:#dc2626;margin-top:10px;">Pour votre sécurité, modifiez ce mot de passe dès votre première connexion.</div>
         </td></tr>
       </table>`
    : `<p style="margin:16px 0;">Vous pouvez vous connecter avec votre adresse email <strong>${esc(params.email)}</strong> (identifiants classiques ou connexion Google).</p>`;

  const body = `
    <h1 style="font-size:20px;margin:0 0 16px;color:#0f172a;">Bienvenue, ${esc(params.prenom)} ${esc(params.nom)} 👋</h1>
    <p style="margin:0 0 12px;">Votre compte AfriGes vient d'être créé${
      params.role ? ` avec le rôle <strong>${esc(params.role)}</strong>` : ""
    }.</p>
    ${identifiants}
    ${emailButton("Se connecter", loginUrl)}
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Si vous n'êtes pas à l'origine de cette création, contactez votre administrateur.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: "Bienvenue sur AfriGes — votre compte est prêt",
    html: renderEmailLayout(body, "Bienvenue sur AfriGes"),
  });
}

export interface BulletinPaieEmailParams {
  to: string;
  prenom: string;
  nom: string;
  /** Libellé de période, ex. "Mars 2026". */
  periodeLabel: string;
  /** Net à payer formaté, ex. "185 000 FCFA" (optionnel). */
  netAPayer?: string;
  /** PDF du bulletin (Buffer) à joindre. */
  pdf: Buffer;
  /** Nom du fichier joint. */
  filename: string;
}

/**
 * Envoie le bulletin de paie (PDF en pièce jointe) au collaborateur.
 * Non-bloquant : retourne false sans lever d'exception en cas d'échec.
 */
export async function sendBulletinPaieEmail(params: BulletinPaieEmailParams): Promise<boolean> {
  const body = `
    <h1 style="font-size:20px;margin:0 0 16px;color:#0f172a;">Votre bulletin de paie — ${esc(params.periodeLabel)}</h1>
    <p style="margin:0 0 12px;">Bonjour ${esc(params.prenom)} ${esc(params.nom)},</p>
    <p style="margin:0 0 12px;">Veuillez trouver ci-joint votre bulletin de paie pour la période <strong>${esc(params.periodeLabel)}</strong>.</p>
    ${
      params.netAPayer
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;">
             <tr><td style="padding:16px 20px;">
               <div style="font-size:13px;color:#047857;">Net à payer</div>
               <div style="font-size:22px;font-weight:700;color:#047857;margin-top:4px;">${esc(params.netAPayer)}</div>
             </td></tr>
           </table>`
        : ""
    }
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Ce document est confidentiel. En cas d'erreur, contactez le service RH.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Bulletin de paie — ${params.periodeLabel}`,
    html: renderEmailLayout(body, "Bulletin de paie"),
    attachments: [{ filename: params.filename, content: params.pdf }],
  });
}

export interface RetardRIAEmailParams {
  /** Emails des destinataires internes (staff). */
  to: string[];
  niveau: number;
  /** Libellé du palier, ex. "Alerte chef d'agence". */
  libelle: string;
  clientNom: string;
  reference: string;
  joursRetard: number;
  /** Encours formaté, ex. "1 250 000". */
  encours: string;
  /** Lien vers le dossier de financement. */
  actionUrl: string;
  /** true → bandeau rouge (HAUTE/URGENT). */
  urgent?: boolean;
}

/**
 * Alerte email de recouvrement RIA envoyée au staff interne responsable
 * du palier d'escalade franchi. Non-bloquant.
 */
export async function sendRetardRIAEmail(params: RetardRIAEmailParams): Promise<boolean> {
  if (!params.to.length) return false;

  const accent = params.urgent ? "#dc2626" : "#0f172a";
  const href = params.actionUrl.startsWith("http")
    ? params.actionUrl
    : `${appUrl()}${params.actionUrl}`;

  const body = `
    <p style="display:inline-block;background:${accent};color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;margin:0 0 12px;">
      Niveau ${params.niveau} · ${esc(params.libelle)}
    </p>
    <h1 style="font-size:19px;margin:0 0 12px;color:#0f172a;">Financement RIA en retard</h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <tr><td style="padding:16px 20px;font-size:14px;line-height:1.8;">
        <div><strong>Client :</strong> ${esc(params.clientNom)}</div>
        <div><strong>Financement :</strong> ${esc(params.reference)}</div>
        <div><strong>Retard :</strong> <span style="color:${accent};font-weight:700;">${params.joursRetard} jour(s)</span></div>
        <div><strong>Encours :</strong> ${esc(params.encours)} FCFA</div>
      </td></tr>
    </table>
    ${emailButton("Voir le dossier", href)}
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Merci d'engager l'action de recouvrement correspondant à ce palier.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `RIA · Retard N${params.niveau} — ${params.clientNom} (${params.joursRetard} j)`,
    html: renderEmailLayout(body, "Alerte recouvrement RIA"),
  });
}
