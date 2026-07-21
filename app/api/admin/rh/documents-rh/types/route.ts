import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/authAdmin";
import { listTemplateMeta } from "@/lib/rhDocTemplates/registry";

/**
 * GET /api/admin/rh/documents-rh/types
 * Métadonnées des documents générables (type + libellé + champs libres à saisir),
 * pour construire dynamiquement le formulaire par type côté interface.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  return NextResponse.json({ data: listTemplateMeta() });
}
