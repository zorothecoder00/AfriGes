import { NextResponse } from "next/server";
import { RoleGestionnaire } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";
import { DEFAULT_MATRIX } from "@/lib/permissionsRegistry";
import { JOURNAUX_BUILTIN } from "@/lib/comptabilite/moteur";

/**
 * GET /api/admin/permissions/journaux
 * CDC §68 — droits par journal : pour chaque rôle, la liste des journaux
 * autorisés. Absence totale de ligne pour un rôle = non restreint (tous les
 * journaux cochés côté UI, comportement additif — cf. lib/permissions.ts::journalAutorise).
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const [journauxCustom, restrictions] = await Promise.all([
    prisma.journalComptable.findMany({ where: { actif: true }, select: { code: true, libelle: true } }),
    prisma.roleJournalAutorise.findMany({ select: { role: true, journalCode: true } }),
  ]);

  const journaux = [
    ...JOURNAUX_BUILTIN.map((code) => ({ code, libelle: code })),
    ...journauxCustom.map((j) => ({ code: j.code, libelle: j.libelle })),
  ];

  const roles = Object.keys(DEFAULT_MATRIX);
  const restreintsParRole = new Map<string, Set<string>>();
  for (const r of restrictions) {
    if (!restreintsParRole.has(r.role)) restreintsParRole.set(r.role, new Set());
    restreintsParRole.get(r.role)!.add(r.journalCode);
  }

  const data: Record<string, Record<string, boolean>> = {};
  for (const role of roles) {
    const restreint = restreintsParRole.get(role);
    data[role] = {};
    for (const j of journaux) {
      // Pas de restriction posée pour ce rôle = tout autorisé par défaut.
      data[role][j.code] = restreint ? restreint.has(j.code) : true;
    }
  }

  return NextResponse.json({ data, roles, journaux });
}

/**
 * PUT /api/admin/permissions/journaux
 * body = { role, journauxAutorises: string[] }
 * Remplace intégralement les restrictions du rôle. Envoyer TOUS les journaux
 * cochés revient à supprimer toute restriction (comportement "non restreint").
 */
export async function PUT(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const role = body?.role as string | undefined;
  const journauxAutorises = body?.journauxAutorises as string[] | undefined;

  if (!role || !Object.values(RoleGestionnaire).includes(role as RoleGestionnaire)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }
  if (!Array.isArray(journauxAutorises)) {
    return NextResponse.json({ error: "journauxAutorises doit être un tableau" }, { status: 400 });
  }

  const [journauxCustom] = await Promise.all([
    prisma.journalComptable.findMany({ where: { actif: true }, select: { code: true } }),
  ]);
  const tousJournaux = new Set([...JOURNAUX_BUILTIN, ...journauxCustom.map((j) => j.code)]);
  const totalementAutorise = journauxAutorises.length >= tousJournaux.size
    && [...tousJournaux].every((c) => journauxAutorises.includes(c));

  const updatedBy = Number(session.user.id);
  await prisma.$transaction(async (tx) => {
    await tx.roleJournalAutorise.deleteMany({ where: { role: role as RoleGestionnaire } });
    if (!totalementAutorise) {
      await tx.roleJournalAutorise.createMany({
        data: journauxAutorises.filter((c) => tousJournaux.has(c)).map((journalCode) => ({ role: role as RoleGestionnaire, journalCode })),
      });
    }
  });
  await auditLog(prisma, updatedBy, "MAJ_JOURNAUX_AUTORISES", "RoleJournalAutorise", 0, { role, journauxAutorises });

  return NextResponse.json({ success: true });
}
