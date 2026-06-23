import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { getAdminSession } from "@/lib/authAdmin";

export interface Scope {
  where: Prisma.CreditClientWhereInput; // périmètre des crédits encaissables
  userId: number;                       // « secrétaire » (qui saisit)
  agentCollecteurDefault: number;       // agent collecteur par défaut
  confirmer: boolean;                   // effets financiers immédiats ?
}

export type ScopeOut = { ok: true; scope: Scope } | { ok: false; response: Response };

const refus = (msg: string, status: number): ScopeOut => ({ ok: false, response: NextResponse.json({ error: msg }, { status }) });

/** Admin : tout le périmètre, encaissement confirmé. */
export async function scopeAdmin(): Promise<ScopeOut> {
  const session = await getAdminSession();
  if (!session) return refus("Accès refusé", 403);
  const userId = Number(session.user.id);
  return { ok: true, scope: { where: {}, userId, agentCollecteurDefault: userId, confirmer: true } };
}

/** RVC : crédits des clients de son PDV, encaissement confirmé. */
export async function scopeRVC(): Promise<ScopeOut> {
  const session = await getRVCSession();
  if (!session) return refus("Accès refusé", 403);
  const userId = parseInt(session.user.id);
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  let where: Prisma.CreditClientWhereInput = {};
  if (!isAdmin) {
    const aff = await prisma.gestionnaireAffectation.findFirst({ where: { userId, actif: true }, select: { pointDeVenteId: true } });
    if (!aff) return refus("Aucun point de vente associé", 400);
    where = { client: { pointDeVenteId: aff.pointDeVenteId } };
  }
  return { ok: true, scope: { where, userId, agentCollecteurDefault: userId, confirmer: true } };
}

/** Caissier : crédits des clients de son PDV, encaissement confirmé. */
export async function scopeCaissier(): Promise<ScopeOut> {
  const session = await getCaissierSession();
  if (!session) return refus("Accès refusé", 403);
  const userId = parseInt(session.user.id);
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  let where: Prisma.CreditClientWhereInput = {};
  if (!isAdmin) {
    const pdvId = await getCaissierPdvId(userId);
    if (!pdvId) return refus("Aucun point de vente associé", 400);
    where = { client: { pointDeVenteId: pdvId } };
  }
  return { ok: true, scope: { where, userId, agentCollecteurDefault: userId, confirmer: true } };
}

/** Agent terrain : ses clients affectés, en attente de confirmation caissier. */
export async function scopeAgentTerrain(): Promise<ScopeOut> {
  const session = await getAgentTerrainSession();
  if (!session) return refus("Accès refusé", 403);
  const userId = parseInt(session.user.id);
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  const where: Prisma.CreditClientWhereInput = isAdmin ? {} : { client: { agentTerrainId: userId } };
  // L'agent collecteur par défaut est l'agent lui-même ; saisie en attente caissier.
  return { ok: true, scope: { where, userId, agentCollecteurDefault: userId, confirmer: false } };
}
