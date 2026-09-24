// lib/signature.ts
// Signatures tracées (components/SignaturePad.tsx) reçues par les API de documents
// (bordereau de remise de fonds, fiche de décaissement…) : PNG en data URL.

/** Tracé de signature valide (PNG en data URL, ≈ 300 Ko max) ; null si absent ou invalide. */
export function signatureTracee(v: unknown): string | null {
  if (typeof v !== "string" || !v.startsWith("data:image/png;base64,")) return null;
  return v.length <= 400_000 ? v : null;
}
