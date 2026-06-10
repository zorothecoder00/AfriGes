import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { StatutPoste } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/responsableRH/recrutement/postes/[id] */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const poste  = await prisma.posteOuvert.findUnique({
      where:   { id: Number(id) },
      include: {
        candidatures: { orderBy: { dateCandidature: "desc" } },
        _count:        { select: { candidatures: true } },
      },
    });
    if (!poste) return NextResponse.json({ error: "Poste introuvable" }, { status: 404 });

    return NextResponse.json({ data: poste });
  } catch (error) {
    console.error("GET /api/responsableRH/recrutement/postes/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** PATCH /api/responsableRH/recrutement/postes/[id] */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { action, ...fields } = body;

    const poste = await prisma.posteOuvert.findUnique({ where: { id: Number(id) } });
    if (!poste) return NextResponse.json({ error: "Poste introuvable" }, { status: 404 });

    if (action) {
      const TRANSITIONS: Record<string, { from: StatutPoste[]; to: StatutPoste }> = {
        VALIDER:         { from: ["BROUILLON"],                    to: "OUVERT"   },
        DEMARRER:        { from: ["OUVERT"],                       to: "EN_COURS" },
        MARQUER_POURVU:  { from: ["OUVERT", "EN_COURS"],          to: "POURVU"   },
        ANNULER:         { from: ["BROUILLON","OUVERT","EN_COURS"], to: "ANNULE"   },
        ROUVRIR:         { from: ["POURVU", "ANNULE"],             to: "OUVERT"   },
      };

      const t = TRANSITIONS[action];
      if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!t.from.includes(poste.statut as StatutPoste)) {
        return NextResponse.json({ error: `Impossible depuis le statut ${poste.statut}` }, { status: 422 });
      }

      const updated = await prisma.posteOuvert.update({
        where: { id: Number(id) },
        data:  { statut: t.to },
      });

      await prisma.auditLog.create({
        data: {
          userId:   parseInt(session.user.id),
          action:   `POSTE_${action}`,
          entite:   "PosteOuvert",
          entiteId: Number(id),
        },
      });

      return NextResponse.json({ data: updated });
    }

    // Édition libre
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (fields.titre          !== undefined) data.titre          = fields.titre;
    if (fields.departement    !== undefined) data.departement    = fields.departement    || null;
    if (fields.service        !== undefined) data.service        = fields.service        || null;
    if (fields.lieu           !== undefined) data.lieu           = fields.lieu           || null;
    if (fields.typeContrat    !== undefined) data.typeContrat    = fields.typeContrat    || null;
    if (fields.description    !== undefined) data.description    = fields.description    || null;
    if (fields.exigences      !== undefined) data.exigences      = fields.exigences      || null;
    if (fields.experienceMin  !== undefined) data.experienceMin  = fields.experienceMin  ? Number(fields.experienceMin) : null;
    if (fields.nbPostes       !== undefined) data.nbPostes       = fields.nbPostes       ? Number(fields.nbPostes) : 1;
    if (fields.salaireMini    !== undefined) data.salaireMini    = fields.salaireMini    ? Number(fields.salaireMini) : null;
    if (fields.salaireMaxi    !== undefined) data.salaireMaxi    = fields.salaireMaxi    ? Number(fields.salaireMaxi) : null;
    if (fields.budgetPoste    !== undefined) data.budgetPoste    = fields.budgetPoste    ? Number(fields.budgetPoste) : null;
    if (fields.dateLimite     !== undefined) data.dateLimite     = fields.dateLimite     ? new Date(fields.dateLimite) : null;
    if (fields.notes          !== undefined) data.notes          = fields.notes          || null;

    const updated = await prisma.posteOuvert.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/responsableRH/recrutement/postes/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** DELETE /api/responsableRH/recrutement/postes/[id] — annule le poste */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const poste  = await prisma.posteOuvert.findUnique({ where: { id: Number(id) } });
    if (!poste) return NextResponse.json({ error: "Poste introuvable" }, { status: 404 });

    if (!["BROUILLON", "OUVERT", "EN_COURS"].includes(poste.statut)) {
      return NextResponse.json({ error: "Seuls les postes actifs peuvent être annulés" }, { status: 422 });
    }

    await prisma.posteOuvert.update({
      where: { id: Number(id) },
      data:  { statut: "ANNULE" },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "ANNULER_POSTE",
        entite:   "PosteOuvert",
        entiteId: Number(id),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/responsableRH/recrutement/postes/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
