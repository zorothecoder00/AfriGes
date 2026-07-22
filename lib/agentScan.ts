// lib/agentScan.ts
// Accès SANS login (QR « capability URL ») à la tournée + objectifs du jour d'un
// agent terrain. Le jeton opaque contenu dans l'URL fait office de clé. Serveur only.

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { genererTournee } from "@/lib/popc/tourneeServer";

/** Jeton opaque URL-safe (~32 caractères, non devinable). */
function nouveauJeton(): string {
  return randomBytes(24).toString("base64url");
}

/** Retourne le jeton de l'agent, en le générant + persistant s'il n'existe pas. */
export async function getOrCreateScanToken(userId: number): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { scanTokenTournee: true } });
  if (u?.scanTokenTournee) return u.scanTokenTournee;
  return regenerateScanToken(userId);
}

/** (Ré)génère le jeton — invalide l'ancien QR. */
export async function regenerateScanToken(userId: number): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const token = nouveauJeton();
    try {
      await prisma.user.update({ where: { id: userId }, data: { scanTokenTournee: token } });
      return token;
    } catch {
      // Collision (unique) très improbable → on réessaie avec un autre jeton.
    }
  }
  throw new Error("Impossible de générer un jeton de tournée");
}

export interface DonneesScanAgent {
  agent: { nom: string; prenom: string };
  date: string;
  objectifsJour: { quinzaine: number; trentaine: number; carnets: number; disponible: boolean };
  clients: Awaited<ReturnType<typeof genererTournee>>;
}

/**
 * Données affichées sur la page publique scannée : objectifs du JOUR (part de
 * l'agent) + clients à visiter (échéance du jour ou en retard). Retourne null si
 * le jeton est inconnu (lien invalide / révoqué).
 */
export async function donneesScanAgent(token: string, dateStr?: string): Promise<DonneesScanAgent | null> {
  if (!token) return null;
  const user = await prisma.user.findUnique({
    where: { scanTokenTournee: token },
    select: { id: true, nom: true, prenom: true },
  });
  if (!user) return null;

  const date = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : new Date().toISOString().slice(0, 10);
  const [y, m] = date.split("-").map(Number);

  // Objectifs du mois (paramétrage POPC global) → part quotidienne par agent.
  const param = await prisma.parametragePOPC.findUnique({
    where: { annee_mois_pointDeVenteId: { annee: y, mois: m, pointDeVenteId: 0 } },
    include: { objectif: true },
  });
  let objectifsJour = { quinzaine: 0, trentaine: 0, carnets: 0, disponible: false };
  if (param?.objectif) {
    const jours = param.joursOuvrables > 0 ? param.joursOuvrables : 26;
    const agents = param.nombreAgentsTerrain > 0 ? param.nombreAgentsTerrain : 1;
    const parAgent = (n: number) => (n > 0 ? Math.ceil(n / jours / agents) : 0);
    objectifsJour = {
      quinzaine: parAgent(param.objectif.nbSeiziemes),
      trentaine: parAgent(param.objectif.nbTrentiemes),
      carnets: parAgent(param.objectif.nbCarnets),
      disponible: true,
    };
  }

  const clients = await genererTournee(user.id, date);
  return { agent: { nom: user.nom, prenom: user.prenom }, date, objectifsJour, clients };
}
