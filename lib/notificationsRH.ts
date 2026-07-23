/**
 * lib/notificationsRH.ts
 *
 * Notifications in-app spécifiques au module RH.
 *
 * DÉCLENCHEURS :
 *   1. alertesFinContrat()          — CDD expirant J-30 et J-7
 *   2. alertesDocumentsExpirants()  — documents collaborateur expirant J-30
 *   3. alertesEvaluationsProg()     — évaluations débutant dans J-7
 *   4. alertesFormationsAsuivre()   — formations inscrites débutant dans J-3
 *   5. notifyValidationConge()      — in-action : congé approuvé / refusé
 *   6. notifyInscriptionFormation() — in-action : inscription à une formation
 *
 * DESTINATAIRES :
 *   Fin contrat / Document expirant  → collaborateur + tous RESPONSABLE_RH actifs
 *   Validation congé                 → collaborateur uniquement
 *   Évaluation programmée            → collaborateur uniquement
 *   Formation à suivre               → collaborateur uniquement
 *
 * DÉDUPLICATION : une alerte du même type n'est envoyée qu'une fois par jour par entité.
 *
 * PRÉFÉRENCES : respecte PreferenceNotificationRH par userId.
 *   Valeur par défaut si absent : tous les déclencheurs activés.
 */

import { prisma } from "@/lib/prisma";
import { PrioriteNotification } from "@prisma/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Renvoie vrai si une notification avec ce titreKey a déjà été créée aujourd'hui pour cet user. */
async function dejaNotifie(userId: number, titreKey: string): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      titre:     { contains: titreKey },
      createdAt: { gte: todayStart() },
    },
    select: { id: true },
  });
  return !!existing;
}

/** Crée une notification in-app pour une liste d'userIds (déduplique). */
async function createNotifs(
  userIds: number[],
  payload: { titre: string; message: string; priorite?: PrioriteNotification; actionUrl?: string }
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      titre:     payload.titre,
      message:   payload.message,
      priorite:  payload.priorite ?? PrioriteNotification.NORMAL,
      actionUrl: payload.actionUrl ?? null,
    })),
    skipDuplicates: true,
  });
}

/** Renvoie les User.id de tous les RESPONSABLE_RH actifs. */
async function getRHManagerIds(): Promise<number[]> {
  const users = await prisma.user.findMany({
    where:  { gestionnaire: { role: "RESPONSABLE_RH", actif: true } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Renvoie les User.id des ADMIN / SUPER_ADMIN (Direction). */
async function getAdminIds(): Promise<number[]> {
  const users = await prisma.user.findMany({
    where:  { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/**
 * Résout, par PDV, les RESPONSABLE_RH affectés, et le PDV de chaque collaborateur.
 * Sert à n'envoyer les copies de surveillance qu'au(x) RH du PDV concerné.
 */
type RHByPdvLookup = { pdvByUser: Map<number, number>; rhByPdv: Map<number, number[]> };

async function getRHByPdvLookup(): Promise<RHByPdvLookup> {
  const rhIds = new Set(await getRHManagerIds());
  const affs  = await prisma.gestionnaireAffectation.findMany({
    where:  { actif: true },
    select: { userId: true, pointDeVenteId: true },
  });
  const pdvByUser = new Map<number, number>();
  const rhByPdv   = new Map<number, number[]>();
  for (const a of affs) {
    pdvByUser.set(a.userId, a.pointDeVenteId);
    if (rhIds.has(a.userId)) {
      const list = rhByPdv.get(a.pointDeVenteId) ?? [];
      list.push(a.userId);
      rhByPdv.set(a.pointDeVenteId, list);
    }
  }
  return { pdvByUser, rhByPdv };
}

/** RESPONSABLE_RH du PDV d'un collaborateur (via son User.id) ; [] si PDV/RH introuvable. */
function rhForCollaborator(lookup: RHByPdvLookup, collabUserId: number): number[] {
  const pdv = lookup.pdvByUser.get(collabUserId);
  if (pdv == null) return [];
  return lookup.rhByPdv.get(pdv) ?? [];
}

/**
 * Renvoie le User.id d'un collaborateur (ProfilRH) via son gestionnaire.
 * Retourne null si introuvable.
 */
async function getUserIdFromProfil(profilRHId: number): Promise<number | null> {
  const profil = await prisma.profilRH.findUnique({
    where:  { id: profilRHId },
    select: { gestionnaire: { select: { memberId: true } } },
  });
  return profil?.gestionnaire.memberId ?? null;
}

/**
 * Vérifie si un utilisateur a activé un déclencheur dans ses préférences.
 * Retourne true par défaut si aucune préférence n'est définie.
 */
async function prefActivee(userId: number, champ: keyof {
  finContrat: boolean; validationConge: boolean;
  evaluationProg: boolean; formationAsuivre: boolean; documentExpirant: boolean;
}): Promise<boolean> {
  const pref = await prisma.preferenceNotificationRH.findUnique({
    where:  { userId },
    select: { [champ]: true },
  });
  if (!pref) return true; // défaut : activé
  return (pref as Record<string, boolean>)[champ] ?? true;
}

// ─── 1. Fin de contrat ────────────────────────────────────────────────────────

/**
 * Notifie les collaborateurs CDD dont le contrat expire dans 30j ou 7j.
 * Notifie aussi les RESPONSABLE_RH pour monitoring.
 *
 * `profilRHIds` : restreint le scan à ces collaborateurs (périmètre PDV du RH).
 * `null`/absent = tous les collaborateurs (admin / CRON).
 */
export async function alertesFinContrat(profilRHIds?: number[] | null): Promise<number> {
  const now      = new Date();
  const j7end    = daysFromNow(7);
  const j30end   = daysFromNow(30);
  const j7start  = new Date(now); j7start.setDate(now.getDate() + 6); j7start.setHours(0, 0, 0, 0);
  const j30start = new Date(now); j30start.setDate(now.getDate() + 29); j30start.setHours(0, 0, 0, 0);

  // Contrats expirant dans exactement ~7j ou ~30j
  const profils = await prisma.profilRH.findMany({
    where: {
      typeContrat: "CDD",
      statut:      "ACTIF",
      dateFin: {
        gte: j7start,
        lte: j30end,
      },
      ...(profilRHIds ? { id: { in: profilRHIds } } : {}),
    },
    select: {
      id: true, matricule: true, dateFin: true,
      gestionnaire: {
        select: {
          memberId: true,
          member:   { select: { nom: true, prenom: true } },
        },
      },
    },
  });

  const lookup = await getRHByPdvLookup();
  let sent    = 0;

  for (const p of profils) {
    const userId    = p.gestionnaire.memberId;
    const nomCollab = `${p.gestionnaire.member.prenom} ${p.gestionnaire.member.nom}`;
    const dateFin   = new Date(p.dateFin!).toLocaleDateString("fr-FR");
    const daysLeft  = Math.ceil((new Date(p.dateFin!).getTime() - now.getTime()) / 86400_000);
    const urgence   = daysLeft <= 7;
    const titreKey  = `Fin de contrat J-${urgence ? 7 : 30}`;

    // Préférence du collaborateur
    if (await prefActivee(userId, "finContrat") && !(await dejaNotifie(userId, titreKey))) {
      await createNotifs([userId], {
        titre:    `${titreKey} — Votre contrat expire le ${dateFin}`,
        message:  `Votre contrat CDD (${p.matricule}) arrive à terme le ${dateFin} (dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}).`,
        priorite: urgence ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/rh/collaborateurs/${p.id}`,
      });
      sent++;
    }

    // Notification de surveillance au(x) RH du PDV du collaborateur
    const titreRH = `[RH] ${titreKey} — ${nomCollab}`;
    for (const rhId of rhForCollaborator(lookup, userId)) {
      if (!(await dejaNotifie(rhId, titreRH))) {
        await createNotifs([rhId], {
          titre:    titreRH,
          message:  `Le CDD de ${nomCollab} (${p.matricule}) expire le ${dateFin} (dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}).`,
          priorite: urgence ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/admin/rh/collaborateurs/${p.id}`,
        });
        sent++;
      }
    }
  }

  return sent;
}

// ─── 2. Documents expirants ───────────────────────────────────────────────────

/**
 * Notifie les collaborateurs dont un document (CNI, passeport…) expire dans 30j.
 * Notifie aussi les RESPONSABLE_RH.
 */
export async function alertesDocumentsExpirants(profilRHIds?: number[] | null): Promise<number> {
  const now    = new Date();
  const j30    = daysFromNow(30);

  const docs = await prisma.documentCollaborateur.findMany({
    where: {
      dateExpiration: { gte: now, lte: j30 },
      ...(profilRHIds ? { profilRHId: { in: profilRHIds } } : {}),
    },
    select: {
      id: true, type: true, nom: true, dateExpiration: true,
      profilRH: {
        select: {
          id: true, matricule: true,
          gestionnaire: {
            select: {
              memberId: true,
              member:   { select: { nom: true, prenom: true } },
            },
          },
        },
      },
    },
  });

  const lookup = await getRHByPdvLookup();
  let sent    = 0;

  for (const doc of docs) {
    const userId    = doc.profilRH.gestionnaire.memberId;
    const nomCollab = `${doc.profilRH.gestionnaire.member.prenom} ${doc.profilRH.gestionnaire.member.nom}`;
    const dateExp   = new Date(doc.dateExpiration!).toLocaleDateString("fr-FR");
    const daysLeft  = Math.ceil((new Date(doc.dateExpiration!).getTime() - now.getTime()) / 86400_000);
    const titreKey  = `Document expirant — ${doc.nom}`;

    if (await prefActivee(userId, "documentExpirant") && !(await dejaNotifie(userId, titreKey))) {
      await createNotifs([userId], {
        titre:    titreKey,
        message:  `Votre ${doc.nom.toLowerCase()} arrive à expiration le ${dateExp} (dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}).`,
        priorite: daysLeft <= 7 ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/rh/collaborateurs/${doc.profilRH.id}`,
      });
      sent++;
    }

    // Copie de surveillance au(x) RH du PDV du collaborateur
    const titreRH = `[RH] Document expirant — ${nomCollab} (${doc.nom})`;
    for (const rhId of rhForCollaborator(lookup, userId)) {
      if (!(await dejaNotifie(rhId, titreRH))) {
        await createNotifs([rhId], {
          titre:    titreRH,
          message:  `Le document "${doc.nom}" de ${nomCollab} (${doc.profilRH.matricule}) expire le ${dateExp} (dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}).`,
          priorite: daysLeft <= 7 ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/admin/rh/collaborateurs/${doc.profilRH.id}`,
        });
        sent++;
      }
    }
  }

  return sent;
}

// ─── 3. Évaluations programmées ────────────────────────────────────────────────

/**
 * Notifie les collaborateurs dont une évaluation débute dans les 7 prochains jours.
 */
export async function alertesEvaluationsProg(profilRHIds?: number[] | null): Promise<number> {
  const now  = new Date();
  const j7   = daysFromNow(7);

  const evals = await prisma.evaluationRH.findMany({
    where: {
      statut:    { in: ["BROUILLON", "OBJECTIFS_FIXES"] },
      dateDebut: { gte: now, lte: j7 },
      ...(profilRHIds ? { profilRHId: { in: profilRHIds } } : {}),
    },
    select: {
      id: true, annee: true, periode: true, dateDebut: true,
      profilRH: {
        select: {
          id: true, matricule: true,
          gestionnaire: { select: { memberId: true } },
        },
      },
    },
  });

  let sent = 0;

  for (const ev of evals) {
    const userId   = ev.profilRH.gestionnaire.memberId;
    const date     = new Date(ev.dateDebut).toLocaleDateString("fr-FR");
    const titreKey = `Évaluation programmée J-7 #${ev.id}`;

    if (await prefActivee(userId, "evaluationProg") && !(await dejaNotifie(userId, titreKey))) {
      await createNotifs([userId], {
        titre:    `Évaluation programmée le ${date}`,
        message:  `Votre évaluation de performance (période : ${ev.periode} ${ev.annee}) est prévue le ${date}. Préparez-vous !`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/rh/evaluations`,
      });
      sent++;
    }
  }

  return sent;
}

// ─── 4. Formations à suivre ────────────────────────────────────────────────────

/**
 * Notifie les participants inscrits à une formation débutant dans 3 jours.
 */
export async function alertesFormationsAsuivre(profilRHIds?: number[] | null): Promise<number> {
  const now = new Date();
  const j3  = daysFromNow(3);

  const participations = await prisma.participationFormation.findMany({
    where: {
      statut:    "INSCRIT",
      formation: {
        statut:    "PLANIFIEE",
        dateDebut: { gte: now, lte: j3 },
      },
      ...(profilRHIds ? { profilRHId: { in: profilRHIds } } : {}),
    },
    select: {
      profilRHId: true,
      formation:  { select: { id: true, titre: true, dateDebut: true, lieu: true } },
      profilRH: {
        select: { gestionnaire: { select: { memberId: true } } },
      },
    },
  });

  let sent = 0;

  for (const p of participations) {
    const userId   = p.profilRH.gestionnaire.memberId;
    const date     = new Date(p.formation.dateDebut!).toLocaleDateString("fr-FR");
    const titreKey = `Formation à suivre J-3 #${p.formation.id}`;

    if (await prefActivee(userId, "formationAsuivre") && !(await dejaNotifie(userId, titreKey))) {
      await createNotifs([userId], {
        titre:    `Formation "${p.formation.titre}" dans 3 jours`,
        message:  `Vous êtes inscrit(e) à la formation "${p.formation.titre}" débutant le ${date}${p.formation.lieu ? ` à ${p.formation.lieu}` : ""}. Pensez à vous préparer.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/rh/formations`,
      });
      sent++;
    }
  }

  return sent;
}

// ─── 4bis. Congés en attente de validation (rappel aux valideurs) ─────────────

/**
 * Rappelle aux valideurs les demandes de congé qui attendent leur décision :
 *   - Managers directs → congés EN_ATTENTE de leur équipe
 *   - RESPONSABLE_RH   → congés EN_ATTENTE + VALIDE_MANAGER (niveau RH)
 *   - Direction (admin) → congés VALIDE_RH (validation finale)
 * Déduplication : un rappel par valideur et par jour.
 */
export async function alertesCongesEnAttente(profilRHIds?: number[] | null): Promise<number> {
  let sent = 0;
  const urlRH    = "/dashboard/user/responsablesRH/conges";
  const urlAdmin = "/dashboard/admin/rh/conges";
  const scopeWhere = profilRHIds ? { profilRHId: { in: profilRHIds } } : {};

  const lookup = await getRHByPdvLookup();

  const [enAttente, valideManagerList, valideRH] = await Promise.all([
    prisma.demandeConge.findMany({
      where:  { statut: "EN_ATTENTE", ...scopeWhere },
      select: {
        profilRH: {
          select: {
            gestionnaire: { select: { memberId: true } },
            manager:      { select: { gestionnaire: { select: { memberId: true } } } },
          },
        },
      },
    }),
    prisma.demandeConge.findMany({
      where:  { statut: "VALIDE_MANAGER", ...scopeWhere },
      select: { profilRH: { select: { gestionnaire: { select: { memberId: true } } } } },
    }),
    prisma.demandeConge.count({ where: { statut: "VALIDE_RH", ...scopeWhere } }),
  ]);

  // 1) Managers directs : congés EN_ATTENTE de leur équipe
  const parManager = new Map<number, number>();
  for (const d of enAttente) {
    const mid = d.profilRH.manager?.gestionnaire.memberId;
    if (mid) parManager.set(mid, (parManager.get(mid) ?? 0) + 1);
  }
  for (const [managerId, count] of parManager) {
    const titreKey = "Congés à valider (manager)";
    if (!(await dejaNotifie(managerId, titreKey))) {
      await createNotifs([managerId], {
        titre:    titreKey,
        message:  `${count} demande(s) de congé de votre équipe attendent votre validation.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: urlRH,
      });
      sent++;
    }
  }

  // 2) RESPONSABLE_RH : EN_ATTENTE + VALIDE_MANAGER, regroupés par PDV → RH du PDV concerné
  const collabUserIds = [
    ...enAttente.map((d) => d.profilRH.gestionnaire.memberId),
    ...valideManagerList.map((d) => d.profilRH.gestionnaire.memberId),
  ];
  const parPdv = new Map<number, number>();
  for (const uid of collabUserIds) {
    const pdv = lookup.pdvByUser.get(uid);
    if (pdv != null) parPdv.set(pdv, (parPdv.get(pdv) ?? 0) + 1);
  }
  for (const [pdv, count] of parPdv) {
    const titreKey = "Congés à valider (RH)";
    for (const rhId of lookup.rhByPdv.get(pdv) ?? []) {
      if (!(await dejaNotifie(rhId, titreKey))) {
        await createNotifs([rhId], {
          titre:    titreKey,
          message:  `${count} demande(s) de congé de votre point de vente attendent une validation RH.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: urlRH,
        });
        sent++;
      }
    }
  }

  // 3) Direction (admin) : validation finale VALIDE_RH
  if (valideRH > 0) {
    const titreKey = "Congés à valider (Direction)";
    for (const adminId of await getAdminIds()) {
      if (!(await dejaNotifie(adminId, titreKey))) {
        await createNotifs([adminId], {
          titre:    titreKey,
          message:  `${valideRH} demande(s) de congé attendent la validation finale de la Direction.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: urlAdmin,
        });
        sent++;
      }
    }
  }

  return sent;
}

// ─── 5. Validation de congé (in-action) ───────────────────────────────────────

/**
 * À appeler depuis l'API quand un congé est approuvé ou refusé.
 * Notifie uniquement le collaborateur concerné.
 */
export async function notifyValidationConge(
  demandeCongeId: number,
  approuve:        boolean,
  motifRefus?:     string
): Promise<void> {
  const demande = await prisma.demandeConge.findUnique({
    where:  { id: demandeCongeId },
    select: {
      id: true, type: true, dateDebut: true, dateFin: true,
      profilRH: {
        select: {
          id: true,
          gestionnaire: { select: { memberId: true } },
        },
      },
    },
  });
  if (!demande) return;

  const userId  = demande.profilRH.gestionnaire.memberId;
  const debut   = new Date(demande.dateDebut).toLocaleDateString("fr-FR");
  const fin     = new Date(demande.dateFin).toLocaleDateString("fr-FR");

  if (!(await prefActivee(userId, "validationConge"))) return;

  await createNotifs([userId], {
    titre:    approuve ? "Congé approuvé ✓" : "Congé refusé",
    message:  approuve
      ? `Votre demande de congé du ${debut} au ${fin} a été approuvée.`
      : `Votre demande de congé du ${debut} au ${fin} a été refusée.${motifRefus ? ` Motif : ${motifRefus}` : ""}`,
    priorite: approuve ? PrioriteNotification.NORMAL : PrioriteNotification.HAUTE,
    actionUrl: `/dashboard/admin/rh/conges`,
  });
}

// ─── 5bis. Nouvelle demande de congé (in-action) ──────────────────────────────

const TYPE_CONGE_LABEL: Record<string, string> = {
  ANNUEL: "annuel", MALADIE: "maladie", EXCEPTIONNEL: "exceptionnel",
  PERMISSION: "permission", FORMATION: "formation",
  MATERNITE: "maternité", PATERNITE: "paternité", SANS_SOLDE: "sans solde",
};

/**
 * À appeler quand un collaborateur soumet lui-même une demande de congé.
 * Notifie son manager direct (s'il en a un) + tous les RESPONSABLE_RH actifs
 * afin qu'ils traitent le workflow d'approbation.
 */
export async function notifyNouvelleDemandeConge(demandeCongeId: number): Promise<void> {
  const demande = await prisma.demandeConge.findUnique({
    where:  { id: demandeCongeId },
    select: {
      id: true, type: true, dateDebut: true, dateFin: true, nbJours: true,
      profilRH: {
        select: {
          matricule: true,
          gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          manager: { select: { gestionnaire: { select: { memberId: true } } } },
        },
      },
    },
  });
  if (!demande) return;

  const member    = demande.profilRH.gestionnaire.member;
  const nomCollab = `${member.prenom} ${member.nom}`;
  const debut     = new Date(demande.dateDebut).toLocaleDateString("fr-FR");
  const fin        = new Date(demande.dateFin).toLocaleDateString("fr-FR");
  const typeLabel  = TYPE_CONGE_LABEL[demande.type] ?? demande.type.toLowerCase();

  const rhIds     = await getRHManagerIds();
  const managerId = demande.profilRH.manager?.gestionnaire.memberId ?? null;

  // Destinataires uniques : manager direct + RH (createNotifs déduplique déjà)
  const destinataires = [...(managerId ? [managerId] : []), ...rhIds];

  await createNotifs(destinataires, {
    titre:    `Nouvelle demande de congé — ${nomCollab}`,
    message:  `${nomCollab} (${demande.profilRH.matricule}) a soumis une demande de congé ${typeLabel} du ${debut} au ${fin} (${demande.nbJours} jour${demande.nbJours > 1 ? "s" : ""}). À valider.`,
    priorite: PrioriteNotification.NORMAL,
    actionUrl: `/dashboard/user/responsablesRH/conges`,
  });
}

// ─── 5ter. Avances & Prêts — workflow de demande (in-action) ──────────────────

/**
 * À appeler quand un collaborateur soumet lui-même une demande d'avance ou de prêt.
 * Notifie son manager direct (s'il en a un) + tous les RESPONSABLE_RH actifs.
 */
export async function notifyNouvelleDemandeAvancePret(params: {
  kind:       "AVANCE" | "PRET";
  profilRHId: number;
  montant:    number;
}): Promise<void> {
  const profil = await prisma.profilRH.findUnique({
    where:  { id: params.profilRHId },
    select: {
      matricule: true,
      gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
      manager: { select: { gestionnaire: { select: { memberId: true } } } },
    },
  });
  if (!profil) return;

  const member    = profil.gestionnaire.member;
  const nomCollab = `${member.prenom} ${member.nom}`;
  const montant   = new Intl.NumberFormat("fr-FR").format(Math.round(params.montant)) + " FCFA";
  const label     = params.kind === "AVANCE" ? "avance sur salaire" : "prêt";

  const rhIds     = await getRHManagerIds();
  const managerId = profil.manager?.gestionnaire.memberId ?? null;
  const destinataires = [...(managerId ? [managerId] : []), ...rhIds];

  await createNotifs(destinataires, {
    titre:    `Nouvelle demande de ${label} — ${nomCollab}`,
    message:  `${nomCollab} (${profil.matricule}) a soumis une demande de ${label} de ${montant}. À valider.`,
    priorite: PrioriteNotification.NORMAL,
    actionUrl: `/dashboard/user/responsablesRH/paie`,
  });
}

/**
 * À appeler lorsqu'une demande d'avance/prêt change de statut (validation ou refus).
 * Notifie uniquement le collaborateur demandeur.
 */
export async function notifyDecisionAvancePret(params: {
  kind:       "AVANCE" | "PRET";
  profilRHId: number;
  montant:    number;
  decision:   "VALIDE_MANAGER" | "APPROUVE" | "REJETE";
  motif?:     string;
}): Promise<void> {
  const userId = await getUserIdFromProfil(params.profilRHId);
  if (!userId) return;

  const montant = new Intl.NumberFormat("fr-FR").format(Math.round(params.montant)) + " FCFA";
  const label   = params.kind === "AVANCE" ? "avance sur salaire" : "prêt";

  const MAP: Record<string, { titre: string; message: string; priorite: PrioriteNotification }> = {
    VALIDE_MANAGER: {
      titre:    `Demande de ${label} validée (manager)`,
      message:  `Votre demande de ${label} de ${montant} a été validée par votre manager et attend l'approbation de la Direction.`,
      priorite: PrioriteNotification.NORMAL,
    },
    APPROUVE: {
      titre:    `Demande de ${label} approuvée ✓`,
      message:  `Votre demande de ${label} de ${montant} a été approuvée. Le remboursement sera prélevé sur vos prochaines paies.`,
      priorite: PrioriteNotification.NORMAL,
    },
    REJETE: {
      titre:    `Demande de ${label} refusée`,
      message:  `Votre demande de ${label} de ${montant} a été refusée.${params.motif ? ` Motif : ${params.motif}` : ""}`,
      priorite: PrioriteNotification.HAUTE,
    },
  };

  const n = MAP[params.decision];
  if (!n) return;

  await createNotifs([userId], {
    ...n,
    actionUrl: `/dashboard/user/collaborateur/avances-prets`,
  });
}

// ─── 5quater. Demande de formation — workflow de demande (in-action) ─────────

/**
 * À appeler quand un collaborateur soumet lui-même une demande de formation.
 * Notifie son manager direct (s'il en a un) + tous les RESPONSABLE_RH actifs.
 */
export async function notifyNouvelleDemandeFormation(demandeFormationId: number): Promise<void> {
  const demande = await prisma.demandeFormation.findUnique({
    where:  { id: demandeFormationId },
    select: {
      intituleSouhaite: true,
      profilRH: {
        select: {
          matricule: true,
          gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          manager: { select: { gestionnaire: { select: { memberId: true } } } },
        },
      },
    },
  });
  if (!demande) return;

  const member    = demande.profilRH.gestionnaire.member;
  const nomCollab = `${member.prenom} ${member.nom}`;

  const rhIds     = await getRHManagerIds();
  const managerId = demande.profilRH.manager?.gestionnaire.memberId ?? null;
  const destinataires = [...(managerId ? [managerId] : []), ...rhIds];

  await createNotifs(destinataires, {
    titre:    `Nouvelle demande de formation — ${nomCollab}`,
    message:  `${nomCollab} (${demande.profilRH.matricule}) a soumis une demande de formation : « ${demande.intituleSouhaite} ». À valider.`,
    priorite: PrioriteNotification.NORMAL,
    actionUrl: `/dashboard/admin/rh/formations`,
  });
}

/**
 * À appeler lorsqu'une demande de formation change de statut.
 * Notifie uniquement le collaborateur demandeur.
 */
export async function notifyDecisionDemandeFormation(params: {
  profilRHId: number;
  intitule:   string;
  decision:   "VALIDE_MANAGER" | "APPROUVE" | "REJETE";
  motif?:     string;
}): Promise<void> {
  const userId = await getUserIdFromProfil(params.profilRHId);
  if (!userId) return;

  const MAP: Record<string, { titre: string; message: string; priorite: PrioriteNotification }> = {
    VALIDE_MANAGER: {
      titre:    "Demande de formation validée (manager)",
      message:  `Votre demande de formation « ${params.intitule} » a été validée par votre manager et attend l'approbation du RH.`,
      priorite: PrioriteNotification.NORMAL,
    },
    APPROUVE: {
      titre:    "Demande de formation approuvée ✓",
      message:  `Votre demande de formation « ${params.intitule} » a été approuvée.`,
      priorite: PrioriteNotification.NORMAL,
    },
    REJETE: {
      titre:    "Demande de formation refusée",
      message:  `Votre demande de formation « ${params.intitule} » a été refusée.${params.motif ? ` Motif : ${params.motif}` : ""}`,
      priorite: PrioriteNotification.HAUTE,
    },
  };

  const n = MAP[params.decision];
  if (!n) return;

  await createNotifs([userId], {
    ...n,
    actionUrl: `/dashboard/user/collaborateur/formations`,
  });
}

// ─── 6. Inscription à une formation (in-action) ───────────────────────────────

/**
 * À appeler depuis l'API quand un collaborateur est ajouté à une formation.
 */
export async function notifyInscriptionFormation(
  formationId: number,
  profilRHId:  number
): Promise<void> {
  const formation = await prisma.formation.findUnique({
    where:  { id: formationId },
    select: { titre: true, dateDebut: true, lieu: true },
  });
  if (!formation) return;

  const userId = await getUserIdFromProfil(profilRHId);
  if (!userId) return;

  const date = formation.dateDebut
    ? new Date(formation.dateDebut).toLocaleDateString("fr-FR")
    : "date à confirmer";

  await createNotifs([userId], {
    titre:    `Inscription confirmée — ${formation.titre}`,
    message:  `Vous avez été inscrit(e) à la formation "${formation.titre}"${formation.dateDebut ? `, prévue le ${date}` : ""}${formation.lieu ? ` à ${formation.lieu}` : ""}.`,
    priorite: PrioriteNotification.NORMAL,
    actionUrl: `/dashboard/admin/rh/formations`,
  });
}

// ─── Runner principal (appelé par le CRON) ────────────────────────────────────

export async function runAlertesRH(): Promise<{
  total: number;
  finContrat: number;
  documentsExpirants: number;
  evaluationsProg: number;
  formationsAsuivre: number;
  congesEnAttente: number;
}> {
  const [finContrat, documentsExpirants, evaluationsProg, formationsAsuivre, congesEnAttente] = await Promise.all([
    alertesFinContrat(),
    alertesDocumentsExpirants(),
    alertesEvaluationsProg(),
    alertesFormationsAsuivre(),
    alertesCongesEnAttente(),
  ]);

  return {
    total: finContrat + documentsExpirants + evaluationsProg + formationsAsuivre + congesEnAttente,
    finContrat,
    documentsExpirants,
    evaluationsProg,
    formationsAsuivre,
    congesEnAttente,
  };
}
