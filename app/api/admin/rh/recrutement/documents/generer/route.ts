import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeDocumentRecrutement } from "@prisma/client";
import { getRecrutementTemplate, type RecrutementCtx } from "@/lib/rhDocTemplates/recrutement";
import type { DocPayload } from "@/lib/rhDocTemplates/types";

/**
 * POST /api/admin/rh/recrutement/documents/generer
 * Body: { type, notes?, posteId? | candidatureId?, ...champs libres }
 *
 * Génère un document de recrutement rattaché au poste (scope « poste ») ou à la
 * candidature (scope « candidature »), le persiste et l'auto-versionne par cible+type.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { type, notes, posteId, candidatureId, ...rest } = body ?? {};

    const template = type ? getRecrutementTemplate(type) : undefined;
    if (!template) {
      return NextResponse.json({ error: "Type de document de recrutement inconnu" }, { status: 400 });
    }

    // Validation des champs requis.
    const payload: DocPayload = rest;
    for (const f of template.fields) {
      if (f.required && !String(payload[f.name] ?? "").trim()) {
        return NextResponse.json({ error: `Champ requis manquant : ${f.label}` }, { status: 400 });
      }
    }

    const today = new Date();
    let ctx: RecrutementCtx;
    let titreCible: string;
    let cible: { posteId: number } | { candidatureId: number };

    if (template.scope === "poste") {
      if (!posteId) return NextResponse.json({ error: "posteId requis pour ce document" }, { status: 400 });
      const poste = await prisma.posteOuvert.findUnique({ where: { id: Number(posteId) } });
      if (!poste) return NextResponse.json({ error: "Poste introuvable" }, { status: 404 });
      ctx = {
        posteRef: poste.reference, posteTitre: poste.titre, departement: poste.departement, service: poste.service,
        lieu: poste.lieu, typeContrat: poste.typeContrat, description: poste.description, exigences: poste.exigences,
        experienceMin: poste.experienceMin, dateLimite: poste.dateLimite, salaireMini: poste.salaireMini, salaireMaxi: poste.salaireMaxi,
        today,
      };
      titreCible = poste.titre;
      cible = { posteId: poste.id };
    } else {
      if (!candidatureId) return NextResponse.json({ error: "candidatureId requis pour ce document" }, { status: 400 });
      const cand = await prisma.candidature.findUnique({ where: { id: Number(candidatureId) }, include: { poste: true } });
      if (!cand) return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });
      ctx = {
        posteRef: cand.poste.reference, posteTitre: cand.poste.titre, departement: cand.poste.departement, service: cand.poste.service,
        lieu: cand.poste.lieu, typeContrat: cand.poste.typeContrat, description: cand.poste.description, exigences: cand.poste.exigences,
        experienceMin: cand.poste.experienceMin, dateLimite: cand.poste.dateLimite, salaireMini: cand.poste.salaireMini, salaireMaxi: cand.poste.salaireMaxi,
        candidatNom: cand.nomCandidat, candidatPrenom: cand.prenomCandidat, email: cand.email, telephone: cand.telephone,
        dateEntretien: cand.dateEntretien, today,
      };
      titreCible = `${cand.prenomCandidat} ${cand.nomCandidat}`;
      cible = { candidatureId: cand.id };
    }

    const contenu = template.render(ctx, payload);
    const titre   = `${template.label} — ${titreCible}`;

    // Versionning par (cible, type).
    const last = await prisma.documentRecrutementGenere.findFirst({
      where:   { type: type as TypeDocumentRecrutement, ...cible },
      orderBy: { version: "desc" },
      select:  { version: true },
    });
    const version = (last?.version ?? 0) + 1;

    const doc = await prisma.documentRecrutementGenere.create({
      data: {
        type: type as TypeDocumentRecrutement,
        titre, version, contenu,
        generePar: parseInt(session.user.id),
        notes: notes ?? null,
        archive: false,
        ...cible,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "DocumentRecrutementGenere",
        entiteId: doc.id,
        details:  `Génération ${type} v${version} — ${titreCible}`,
      },
    });

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/recrutement/documents/generer", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
