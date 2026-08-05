// app/api/cron/comptabilite/sauvegarde/route.ts
//
// CDC Comptabilité §69 — sauvegarde applicative réelle. Avant cette route,
// l'écran SuperAdmin "Politique de sauvegarde" (backup.frequence/retention/
// heure, app/api/superadmin/settings/route.ts) était une façade : aucun cron,
// aucune fonction ne les consommait pour déclencher une vraie sauvegarde.
//
// Contrainte d'hébergement (Vercel serverless) : pas de `pg_dump`/accès shell
// disponible (seul usage de child_process du repo est un script de
// déploiement hors-Vercel). Approche retenue : export JSON applicatif des
// tables comptables critiques via Prisma, uploadé sur UploadThing (stockage
// externe distinct de Neon — répond à l'exigence "backup externe" du CDC).
import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { prisma } from "@/lib/prisma";
import { notifyAdmins } from "@/lib/notifications";

export const runtime = "nodejs";

const utapi = new UTApi();

const DEFAULT_RETENTION_JOURS = 30;

export async function GET(req: Request) {
  const debut = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret") || req.headers.get("authorization")?.replace("Bearer ", "");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const [
      ecritures, lignes, comptes, journaux, exercices, regles, taxes,
    ] = await Promise.all([
      prisma.ecritureComptable.findMany(),
      prisma.ligneEcriture.findMany(),
      prisma.compteComptable.findMany(),
      prisma.journalComptable.findMany(),
      prisma.exerciceComptable.findMany(),
      prisma.regleComptable.findMany(),
      prisma.taxeConfig.findMany(),
    ]);

    const export_ = {
      genereLe: new Date().toISOString(),
      ecritures, lignes, comptes, journaux, exercices, regles, taxes,
    };
    const contenu = JSON.stringify(export_);
    const tailleOctets = Buffer.byteLength(contenu, "utf-8");
    const nomFichier = `backup-comptable-${new Date().toISOString().slice(0, 10)}.json`;

    const fichier = new File([contenu], nomFichier, { type: "application/json" });
    const resultat = await utapi.uploadFiles(fichier);
    if (resultat.error) throw new Error(resultat.error.message);

    await prisma.backupLog.create({
      data: {
        statut: "SUCCES",
        tailleOctets,
        url: resultat.data.url,
        dureeMs: Date.now() - debut,
      },
    });

    // Purge des sauvegardes plus vieilles que la rétention configurée
    // (app/api/superadmin/settings ­— clé "backup.retention", jours).
    const settingRetention = await prisma.systemSetting.findUnique({ where: { key: "backup.retention" } });
    const retentionJours = Number(settingRetention?.value ?? DEFAULT_RETENTION_JOURS) || DEFAULT_RETENTION_JOURS;
    const seuil = new Date(Date.now() - retentionJours * 24 * 60 * 60 * 1000);
    await prisma.backupLog.deleteMany({ where: { dateExecution: { lt: seuil } } });

    return NextResponse.json({ success: true, url: resultat.data.url, tailleOctets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("CRON comptabilite/sauvegarde error:", error);
    await prisma.backupLog.create({
      data: { statut: "ECHEC", erreur: message, dureeMs: Date.now() - debut },
    });
    await notifyAdmins(prisma, {
      titre: "Échec de la sauvegarde comptable",
      message: `La sauvegarde automatique a échoué : ${message}`,
      priorite: "HAUTE",
      actionUrl: "/dashboard/admin/superadmin",
    });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
