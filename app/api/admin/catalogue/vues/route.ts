import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/authAdmin";
import { toutesLesVues } from "@/lib/vuesCatalogueServer";

/**
 * Vues catalogue par rôle (Catalogue §21-22) — admin.
 * GET — liste des vues effectives (A→J), personnalisées ou par défaut.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const vues = await toutesLesVues();
  return NextResponse.json({ data: vues });
}
