import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { genererSalleVisio } from "@/lib/visioReunion";
import { notify } from "@/lib/notifications";
import { StatutReunionCommissionRIA, PrioriteNotification } from "@prisma/client";

const URL_PRESENCE_MEMBRE = (reunionId: number) => `/dashboard/user/gouvernance/reunions/${reunionId}`;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reunion = await prisma.reunionCommissionRIA.findUnique({
      where: { id: parseInt(id) },
      include: {
        organisateur: { select: { id: true, nom: true, prenom: true } },
        presences: {
          include: {
            membre: {
              include: {
                user: { select: { id: true, nom: true, prenom: true } },
              },
            },
          },
        },
        resolutions: {
          include: {
            responsable: { select: { id: true, nom: true, prenom: true } },
            plansAction: true,
          },
          orderBy: { numero: "asc" },
        },
        plansAction: {
          include: { responsable: { select: { id: true, nom: true, prenom: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!reunion) return NextResponse.json({ error: "Réunion introuvable" }, { status: 404 });
    return NextResponse.json(reunion);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reunionId = parseInt(id);
    const body = await req.json();
    const { titre, dateHeure, lieu, ordreJour, statut, compteRendu, convoquer, lienVisio, activerVisio } = body;

    const existante = await prisma.reunionCommissionRIA.findUnique({
      where: { id: reunionId },
      select: { typeCommission: true, statut: true, salleVisio: true },
    });
    if (!existante) return NextResponse.json({ error: "Réunion introuvable" }, { status: 404 });

    // Détecte l'ouverture effective de la séance (transition vers EN_COURS) pour
    // n'envoyer le rappel de signature qu'une seule fois.
    const passageEnCours = statut === "EN_COURS" && existante.statut !== "EN_COURS";

    const reunion = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {
        ...(titre !== undefined ? { titre } : {}),
        ...(dateHeure !== undefined ? { dateHeure: new Date(dateHeure) } : {}),
        ...(lieu !== undefined ? { lieu } : {}),
        ...(ordreJour !== undefined ? { ordreJour } : {}),
        ...(statut !== undefined ? { statut: statut as StatutReunionCommissionRIA } : {}),
        ...(compteRendu !== undefined ? { compteRendu } : {}),
        ...(lienVisio !== undefined ? { lienVisio: lienVisio?.trim() || null } : {}),
        // Génère une salle Jitsi à la demande si la réunion n'en a pas (réunions anciennes).
        ...(activerVisio === true && !existante.salleVisio ? { salleVisio: genererSalleVisio() } : {}),
      };

      // Convocation (CDC) : marque l'envoi et matérialise la feuille de présence
      // pour tous les membres actifs de la commission (rend la signature possible).
      if (convoquer === true) {
        data.convocationEnvoyee = true;
        data.dateConvocation = new Date();
      }

      const updated = await tx.reunionCommissionRIA.update({
        where: { id: reunionId },
        data,
        include: { organisateur: { select: { id: true, nom: true, prenom: true } } },
      });

      // Membres actifs de la commission : destinataires des feuilles de présence
      // et des notifications de signature (chargés une seule fois si nécessaire).
      const membres =
        convoquer === true || passageEnCours
          ? await tx.membreCommissionRIA.findMany({
              where: { typeCommission: existante.typeCommission, actif: true },
              select: { id: true, userId: true },
            })
          : [];

      // Matérialise la feuille de présence dès la convocation OU à l'ouverture de séance,
      // pour garantir que chaque membre notifié dispose d'une ligne à signer.
      if (convoquer === true || passageEnCours) {
        for (const m of membres) {
          await tx.presenceReunionRIA.upsert({
            where: { reunionId_membreId: { reunionId, membreId: m.id } },
            create: { reunionId, membreId: m.id, present: false },
            update: {},
          });
        }
      }

      if (convoquer === true) {
        await notify(tx, membres.map((m) => m.userId), {
          titre: "Convocation à une réunion de commission",
          message: `Vous êtes convoqué(e) à la réunion « ${updated.titre} ». Préparez votre présence ; la signature sera ouverte au démarrage de la séance.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: URL_PRESENCE_MEMBRE(reunionId),
        });
      }

      // Séance ouverte → l'émargement devient possible : on invite les membres à signer.
      if (passageEnCours) {
        await notify(tx, membres.map((m) => m.userId), {
          titre: "Séance ouverte : signez votre présence",
          message: `La réunion « ${updated.titre} » a démarré. Signez votre présence dès maintenant.`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: URL_PRESENCE_MEMBRE(reunionId),
        });
      }

      return updated;
    });

    return NextResponse.json(reunion);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    // Présences et compte rendu structuré sont supprimés en cascade ;
    // les résolutions liées voient leur reunionId mis à null (relation optionnelle).
    await prisma.reunionCommissionRIA.delete({ where: { id: parseInt(id) } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
