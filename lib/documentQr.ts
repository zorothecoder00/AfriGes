// lib/documentQr.ts
// QR "instance" pour les documents de gestion (CDC digitalisation §4) — chaque
// document soumis/validé embarque un QR permettant de le retrouver et de vérifier
// qu'il n'a pas été falsifié. Simplification assumée : AfriGes est une appli web
// (pas d'appli mobile avec deep link enregistré), donc le QR encode une URL HTTPS
// vers /q/{code}/{id} qui vérifie l'empreinte puis redirige vers l'écran back-office
// concerné (protégé par proxy.ts — l'accès reste soumis à authentification/rôle).

import crypto from "crypto";
import QRCode from "qrcode";

// Empreinte HMAC dérivée du contenu immuable du document (id + date de création) :
// pas besoin de stocker le hash en base, il est recalculé à la volée des deux côtés
// (génération et vérification) et ne peut pas être forgé sans le secret serveur.
const SECRET = process.env.DOCUMENT_QR_SECRET || process.env.NEXTAUTH_SECRET || "afriges-qr-dev-secret-changeme";

export type CodeDocumentQr =
  | "BCF" | "BSM" | "BRF" | "BCC" | "FD" | "BR" | "DEV" | "PRO" | "BP" | "BL"
  // Crédit client (§5.4)
  | "ASF" | "ARC" | "RRC" | "AEC"
  // Revendeurs / B2B (§5.6)
  | "REV" | "BCR" | "BLR" | "FRV"
  // Logistique / tournées (§5.7)
  | "TRN" | "ARL"
  // Retours et réclamations (§5.8)
  | "REC" | "RET" | "BRM" | "INC";

/** Empreinte de sécurité (16 caractères hex) pour une instance de document. */
export function hashInstanceDocument(code: CodeDocumentQr, id: number, createdAtIso: string): string {
  return crypto.createHmac("sha256", SECRET).update(`${code}|${id}|${createdAtIso}`).digest("hex").slice(0, 16);
}

/** Vérifie qu'une empreinte fournie correspond bien au document (anti-falsification). */
export function verifierHashInstance(code: CodeDocumentQr, id: number, createdAtIso: string, hash: string): boolean {
  const attendu = hashInstanceDocument(code, id, createdAtIso);
  if (attendu.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(hash));
}

/**
 * Base publique pour les liens QR. Priorité à une URL configurée
 * (NEXT_PUBLIC_APP_URL / APP_URL) — indispensable en prod et pour scanner depuis un
 * téléphone (sinon l'origine vaudrait « localhost »). Fallback : l'origine de la requête.
 */
export function baseUrlPourDocument(req: Request): string {
  const configuree = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configuree) return configuree.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

/** URL de vérification/ouverture encodée dans le QR d'instance. */
export function qrInstanceUrl(req: Request, code: CodeDocumentQr, id: number, createdAtIso: string): string {
  const hash = hashInstanceDocument(code, id, createdAtIso);
  return `${baseUrlPourDocument(req)}/q/${code}/${id}?h=${hash}`;
}

/** Génère le QR (PNG en data URL) prêt à être embarqué dans un PDF/accusé. */
export async function genererQrDataUrl(texte: string): Promise<string> {
  return QRCode.toDataURL(texte, { margin: 1, width: 180, errorCorrectionLevel: "M" });
}

/**
 * QR « Modèle » (CDC §4.2) : un QR statique par type de document, identique pour tous les agents.
 * Il ne porte aucune donnée : il ouvre le formulaire vierge dans l'app, après authentification.
 */
export const QR_MODELES = [
  { code: "BRF", libelle: "Bordereau de remise de fonds", cible: "/dashboard/user/agentsTerrain/bordereaux-remise?nouveau=1" },
  { code: "BCC", libelle: "Bon de commande client", cible: "/dashboard/user/agentsTerrain/commandes-client?nouveau=1" },
  { code: "DEV", libelle: "Devis", cible: "/dashboard/user/agentsTerrain/devis-proforma?nouveau=DEVIS" },
  { code: "PRO", libelle: "Facture proforma", cible: "/dashboard/user/agentsTerrain/devis-proforma?nouveau=PROFORMA" },
  { code: "FD", libelle: "Fiche de décaissement", cible: "/dashboard/user/decaissements?nouveau=1" },
] as const;

export function qrModeleUrl(req: Request, code: string): string {
  return `${baseUrlPourDocument(req)}/m/${code}`;
}
