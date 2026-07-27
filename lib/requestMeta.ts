/**
 * lib/requestMeta.ts — Capture IP/User-Agent pour l'audit (CDC §15 "Depuis
 * quelle IP ?"). Le champ AuditLog.ip existait déjà mais n'était renseigné
 * nulle part dans l'application avant ce chantier.
 */
export function getRequestMeta(req: Request): { ip: string | null; userAgent: string | null } {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
  const userAgent = req.headers.get("user-agent");
  return { ip, userAgent };
}
