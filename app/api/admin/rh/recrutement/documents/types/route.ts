import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/authAdmin";
import { listRecrutementMeta } from "@/lib/rhDocTemplates/recrutement";

/**
 * GET /api/admin/rh/recrutement/documents/types
 * Métadonnées des documents de recrutement générables (type + libellé + scope + champs),
 * pour construire dynamiquement les formulaires côté interface.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  return NextResponse.json({ data: listRecrutementMeta() });
}
