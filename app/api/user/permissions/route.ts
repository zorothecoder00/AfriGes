import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { resolveUserPermissions } from "@/lib/permissions";

/**
 * GET /api/user/permissions
 * Permissions granulaires effectives de l'utilisateur courant, par module.
 * Utilisé côté front pour masquer les actions non autorisées.
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const permissions = await resolveUserPermissions(session);
  return NextResponse.json({ permissions });
}
