import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { StatutCandidature } from "@prisma/client";
import bcrypt from "bcryptjs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/responsableRH/recrutement/candidatures/[id]
 * Même workflow que admin — ACCEPTER crée automatiquement le collaborateur + onboarding
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { action, ...editFields } = body;

    const cand = await prisma.candidature.findUnique({
      where:   { id: Number(id) },
      include: { poste: { select: { id: true, titre: true, departement: true, service: true, typeContrat: true } } },
    });
    if (!cand) return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });

    if (action) {
      const TRANSITIONS: Record<string, { from: StatutCandidature[]; to: StatutCandidature }> = {
        PRE_QUALIFIER:        { from: ["RECU"],                                                             to: "PRE_QUALIFICATION" },
        SHORTLISTER:          { from: ["RECU","PRE_QUALIFICATION"],                                         to: "SHORTLISTE"        },
        PLANIFIER_ENTRETIEN:  { from: ["RECU","PRE_QUALIFICATION","SHORTLISTE"],                             to: "ENTRETIEN"         },
        ENVOYER_TEST:         { from: ["ENTRETIEN","SHORTLISTE"],                                            to: "TEST"              },
        VALIDER_CANDIDATURE:  { from: ["TEST","ENTRETIEN"],                                                  to: "VALIDATION"        },
        FAIRE_OFFRE:          { from: ["VALIDATION","ENTRETIEN","SHORTLISTE"],                               to: "OFFRE"             },
        DEMARRER_INTEGRATION: { from: ["OFFRE"],                                                             to: "INTEGRATION"       },
        ACCEPTER:             { from: ["INTEGRATION","OFFRE"],                                               to: "ACCEPTE"           },
        REJETER:              { from: ["RECU","PRE_QUALIFICATION","SHORTLISTE","ENTRETIEN","TEST","VALIDATION","OFFRE"], to: "REJETE" },
      };

      const t = TRANSITIONS[action];
      if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!t.from.includes(cand.statut)) {
        return NextResponse.json({ error: `Impossible depuis le statut ${cand.statut}` }, { status: 422 });
      }

      if (action === "ACCEPTER") {
        const result = await prisma.$transaction(async (tx) => {
          const updated = await tx.candidature.update({ where: { id: Number(id) }, data: { statut: "ACCEPTE" } });

          const email = cand.email?.trim().toLowerCase();
          let user    = email ? await tx.user.findUnique({ where: { email } }) : null;
          let tempPassword: string | null = null;
          let collaborateurCree = false;
          let profilRHId: number | null = null;

          if (!user) {
            const raw  = Math.random().toString(36).slice(-8) + "Rh!";
            tempPassword = raw;
            user = await tx.user.create({
              data: {
                prenom:       cand.prenomCandidat,
                nom:          cand.nomCandidat,
                email:        email ?? `${cand.prenomCandidat.toLowerCase()}.${cand.nomCandidat.toLowerCase()}@afriges.local`,
                passwordHash: await bcrypt.hash(raw, 10),
                role:         "USER",
                telephone:    cand.telephone ?? null,
              },
            });
          }

          let gestionnaire = await tx.gestionnaire.findUnique({ where: { memberId: user.id } });
          if (!gestionnaire) {
            gestionnaire = await tx.gestionnaire.create({ data: { memberId: user.id, role: "AGENT_TERRAIN" } });
          }

          let profilRH = await tx.profilRH.findUnique({ where: { gestionnaireId: gestionnaire.id } });
          if (!profilRH) {
            const year      = new Date().getFullYear();
            const count     = await tx.profilRH.count();
            const matricule = `MAT-${year}-${String(count + 1).padStart(4, "0")}`;
            profilRH = await tx.profilRH.create({
              data: {
                gestionnaireId: gestionnaire.id,
                matricule,
                statut:         "EN_PERIODE_ESSAI",
                dateEmbauche:   new Date(),
                typeContrat:    cand.poste?.typeContrat ?? null,
                fonction:       cand.poste?.titre       ?? null,
                service:        cand.poste?.service     ?? null,
                departement:    cand.poste?.departement ?? null,
              },
            });
            profilRHId        = profilRH.id;
            collaborateurCree = true;
          } else {
            profilRHId = profilRH.id;
          }

          let onboardingCree = false;
          const template = await tx.templateOnboarding.findFirst({
            where:   { actif: true },
            include: { etapes: { orderBy: { ordre: "asc" } } },
            orderBy: { createdAt: "asc" },
          });

          if (template && profilRH) {
            const today   = new Date();
            const dateFin = new Date(today);
            dateFin.setDate(dateFin.getDate() + 30);
            const onboarding = await tx.onboardingEmploye.create({
              data: {
                candidatureId:  Number(id),
                profilRHId:     profilRH.id,
                templateId:     template.id,
                statut:         "EN_COURS",
                dateDebut:      today,
                dateFinPrevue:  dateFin,
                progressionPct: 0,
                createdById:    parseInt(session.user.id),
              },
            });
            if (template.etapes.length > 0) {
              await tx.etapeOnboarding.createMany({
                data: template.etapes.map((e) => ({
                  onboardingId: onboarding.id,
                  titre:        e.titre,
                  description:  e.description ?? null,
                  type:         e.type,
                  ordre:        e.ordre,
                  obligatoire:  e.obligatoire,
                  statut:       "EN_ATTENTE" as const,
                  dateLimite:   e.delaiJours ? new Date(Date.now() + e.delaiJours * 86_400_000) : null,
                })),
              });
            }
            onboardingCree = true;
          }

          await tx.auditLog.create({
            data: {
              userId:   parseInt(session.user.id),
              action:   "ACCEPTER_CANDIDATURE",
              entite:   "Candidature",
              entiteId: Number(id),
              details:  `Accepté par RH — ProfilRH #${profilRHId}${onboardingCree ? " — Onboarding lancé" : ""}`,
            },
          });

          return { updated, profilRHId, collaborateurCree, onboardingCree, tempPassword };
        });

        return NextResponse.json({
          data:              result.updated,
          collaborateurCree: result.collaborateurCree,
          profilRHId:        result.profilRHId,
          onboardingCree:    result.onboardingCree,
          tempPassword:      result.tempPassword,
          message:           result.collaborateurCree
            ? `Collaborateur créé${result.onboardingCree ? " et onboarding lancé" : ""}${result.tempPassword ? `. Mot de passe temporaire : ${result.tempPassword}` : ""}`
            : "Candidature acceptée",
        });
      }

      // Autres transitions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { statut: t.to };
      if (editFields.dateEntretien !== undefined) data.dateEntretien = editFields.dateEntretien ? new Date(editFields.dateEntretien) : null;
      if (editFields.dateTest      !== undefined) data.dateTest      = editFields.dateTest      ? new Date(editFields.dateTest)      : null;
      if (editFields.commentaire   !== undefined) data.commentaire   = editFields.commentaire   ?? null;

      const updated = await prisma.candidature.update({ where: { id: Number(id) }, data });
      return NextResponse.json({ data: updated });
    }

    // Édition libre
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (editFields.noteEntretien    !== undefined) data.noteEntretien    = editFields.noteEntretien    !== null ? Number(editFields.noteEntretien)    : null;
    if (editFields.noteTest         !== undefined) data.noteTest         = editFields.noteTest         !== null ? Number(editFields.noteTest)         : null;
    if (editFields.scoreCandidat    !== undefined) data.scoreCandidat    = editFields.scoreCandidat    !== null ? Number(editFields.scoreCandidat)    : null;
    if (editFields.dateEntretien    !== undefined) data.dateEntretien    = editFields.dateEntretien    ? new Date(editFields.dateEntretien) : null;
    if (editFields.dateTest         !== undefined) data.dateTest         = editFields.dateTest         ? new Date(editFields.dateTest)      : null;
    if (editFields.commentaire      !== undefined) data.commentaire      = editFields.commentaire      ?? null;
    if (editFields.cvUrl            !== undefined) data.cvUrl            = editFields.cvUrl            ?? null;
    if (editFields.lettreUrl        !== undefined) data.lettreUrl        = editFields.lettreUrl        ?? null;
    if (editFields.notes            !== undefined) data.notes            = editFields.notes            ?? null;
    if (editFields.competences      !== undefined) data.competences      = editFields.competences      ?? null;
    if (editFields.formation        !== undefined) data.formation        = editFields.formation        ?? null;
    if (editFields.experienceAnnees !== undefined) data.experienceAnnees = editFields.experienceAnnees !== null ? Number(editFields.experienceAnnees) : null;
    if (editFields.sourceCandidat   !== undefined) data.sourceCandidat   = editFields.sourceCandidat   ?? null;

    const updated = await prisma.candidature.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/responsableRH/recrutement/candidatures/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
