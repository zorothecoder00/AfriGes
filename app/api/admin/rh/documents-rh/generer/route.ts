import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeDocumentRHGenere } from "@prisma/client";
import { getTemplate } from "@/lib/rhDocTemplates/registry";
import type { CollabCtx, DocPayload } from "@/lib/rhDocTemplates/types";

/**
 * POST /api/admin/rh/documents-rh/generer
 * Body: { profilRHId, type, notes?, ...champs libres propres au type }
 *
 * Génère le contenu HTML d'un document à partir du profil du collaborateur et
 * des champs libres du type (registre lib/rhDocTemplates). Le titre et le rendu
 * proviennent du template ; le numéro de version est auto-incrémenté par (profil, type).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { profilRHId, type, notes, ...rest } = body ?? {};

    if (!profilRHId || !type) {
      return NextResponse.json({ error: "profilRHId et type sont obligatoires" }, { status: 400 });
    }

    const template = getTemplate(type);
    if (!template) {
      return NextResponse.json({ error: "Type non supporté pour la génération automatique" }, { status: 400 });
    }

    // Validation des champs requis déclarés par le template.
    const payload: DocPayload = rest;
    for (const f of template.fields) {
      if (f.required && !String(payload[f.name] ?? "").trim()) {
        return NextResponse.json({ error: `Champ requis manquant : ${f.label}` }, { status: 400 });
      }
    }

    const profil = await prisma.profilRH.findUnique({
      where: { id: Number(profilRHId) },
      include: {
        gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
      },
    });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const prenom = profil.gestionnaire.member.prenom;
    const nom    = profil.gestionnaire.member.nom;

    const ctx: CollabCtx = {
      prenom,
      nom,
      matricule:          profil.matricule,
      fonction:           profil.fonction,
      departement:        profil.departement,
      service:            profil.service,
      niveauHierarchique: profil.niveauHierarchique,
      typeContrat:        profil.typeContrat,
      dateEmbauche:       profil.dateEmbauche,
      dateFin:            profil.dateFin,
      emailPro:           profil.emailProfessionnel,
      today:              new Date(),
    };

    const contenu = template.render(ctx, payload);
    const titre   = `${template.label} — ${prenom} ${nom}`;

    // Versionning par (profil, type).
    const lastDoc = await prisma.documentRHGenere.findFirst({
      where:   { profilRHId: Number(profilRHId), type: type as TypeDocumentRHGenere },
      orderBy: { version: "desc" },
      select:  { version: true },
    });
    const version = (lastDoc?.version ?? 0) + 1;

    const doc = await prisma.documentRHGenere.create({
      data: {
        profilRHId: Number(profilRHId),
        type:       type as TypeDocumentRHGenere,
        titre,
        version,
        contenu,
        generePar:  parseInt(session.user.id),
        notes:      notes ?? null,
        archive:    false,
      },
      include: {
        profilRH: {
          select: {
            id: true, matricule: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "DocumentRHGenere",
        entiteId: doc.id,
        details:  `Génération automatique ${type} v${version} pour ${prenom} ${nom} (${profil.matricule})`,
      },
    });

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/documents-rh/generer", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
