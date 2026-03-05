import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/caissier/session
 * Retourne la session active (OUVERTE ou SUSPENDUE) ou null.
 */
export async function GET() {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const sessionActive = await prisma.sessionCaisse.findFirst({
      where: { statut: { in: ["OUVERTE", "SUSPENDUE"] } },
      orderBy: { createdAt: "desc" },
    });

    if (!sessionActive) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...sessionActive,
        fondsCaisse:   Number(sessionActive.fondsCaisse),
        dateOuverture: sessionActive.dateOuverture.toISOString(),
        dateFermeture: sessionActive.dateFermeture?.toISOString() ?? null,
        createdAt:     sessionActive.createdAt.toISOString(),
        updatedAt:     sessionActive.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/caissier/session error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/caissier/session
 * Ouvre une nouvelle session de caisse.
 * Body: { fondsCaisse: number, notes?: string }
 * 409 si une session OUVERTE existe déjà.
 */
export async function POST(req: Request) {
  try {
    const auth = await getCaissierSession();
    if (!auth) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const fondsCaisse = Number(body.fondsCaisse ?? 0);
    if (isNaN(fondsCaisse) || fondsCaisse < 0) {
      return NextResponse.json({ message: "Fonds de caisse invalide" }, { status: 400 });
    }
    const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

    const now          = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // ── Garde : fermer les sessions oubliées des jours précédents ──────────
    // Avant d'ouvrir, on règle proprement tout ce qui traîne d'hier ou avant.
    const sessionsAnciennesOuvertes = await prisma.sessionCaisse.findMany({
      where: {
        statut:        { in: ["OUVERTE", "SUSPENDUE"] },
        dateOuverture: { lt: startOfToday },
      },
    });

    for (const ancienne of sessionsAnciennesOuvertes) {
      const d       = ancienne.dateOuverture;
      const debutJ  = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const finJ    = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const clotureExistante = await prisma.clotureCaisse.findFirst({
        where: { date: { gte: debutJ, lte: finJ } },
      });

      if (!clotureExistante) {
        const [versementsJ, encAgg, decAgg, trfAgg] = await Promise.all([
          prisma.versementPack.findMany({
            where: { datePaiement: { gte: debutJ, lte: finJ } },
            include: { souscription: { select: { clientId: true, userId: true } } },
          }),
          prisma.operationCaisse.aggregate({ _sum: { montant: true }, where: { type: "ENCAISSEMENT", createdAt: { gte: debutJ, lte: finJ } } }),
          prisma.operationCaisse.aggregate({ _sum: { montant: true }, where: { type: "DECAISSEMENT", createdAt: { gte: debutJ, lte: finJ } } }),
          prisma.transfertCaisse.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: debutJ, lte: finJ } } }),
        ]);

        const totalVentes  = versementsJ.length;
        const montantTotal = versementsJ.reduce((s, v) => s + Number(v.montant), 0);
        const panierMoyen  = totalVentes > 0 ? montantTotal / totalVentes : 0;
        const nbClients    = new Set(versementsJ.map((v) => v.souscription.clientId ? `c${v.souscription.clientId}` : v.souscription.userId ? `u${v.souscription.userId}` : null).filter(Boolean)).size;
        const fondsCaisse  = Number(ancienne.fondsCaisse);
        const totalEnc     = Number(encAgg._sum.montant ?? 0);
        const totalDec     = Number(decAgg._sum.montant ?? 0);
        const totalTrf     = Number(trfAgg._sum.montant ?? 0);
        const soldeTheo    = fondsCaisse + montantTotal + totalEnc - totalDec - totalTrf;
        const dateStr      = debutJ.toLocaleDateString("fr-FR");

        await prisma.$transaction(async (tx) => {
          const cloture = await tx.clotureCaisse.create({
            data: {
              date:                     debutJ,
              caissierNom:              ancienne.caissierNom,
              totalVentes,
              montantTotal:             new Prisma.Decimal(montantTotal),
              panierMoyen:              new Prisma.Decimal(panierMoyen),
              nbClients,
              notes:                    `[FERMETURE AUTO à l'ouverture — ${now.toISOString()}] Caisse du ${dateStr} non clôturée.`,
              sessionId:                ancienne.id,
              fondsCaisse:              new Prisma.Decimal(fondsCaisse),
              totalEncaissementsAutres: new Prisma.Decimal(totalEnc),
              totalDecaissements:       new Prisma.Decimal(totalDec),
              totalTransferts:          new Prisma.Decimal(totalTrf),
              soldeTheorique:           new Prisma.Decimal(soldeTheo),
              soldeReel:                null,
              ecart:                    null,
            },
          });

          await tx.sessionCaisse.update({
            where: { id: ancienne.id },
            data:  { statut: "FERMEE", dateFermeture: finJ },
          });

          await auditLog(tx, caissierId, "FERMETURE_AUTO_CAISSE_OUVERTURE", "ClotureCaisse", cloture.id);

          await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE", "COMPTABLE"], {
            titre:    `⚠ Fermeture auto de caisse — ${dateStr}`,
            message:  `La caisse de ${ancienne.caissierNom} du ${dateStr} a été fermée automatiquement à l'ouverture d'une nouvelle session. CA : ${montantTotal.toLocaleString("fr-FR")} FCFA.`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: "/dashboard/user/responsablesPointDeVente",
          });
        });
      } else {
        // Clôture existante : juste fermer la session
        await prisma.sessionCaisse.update({
          where: { id: ancienne.id },
          data:  { statut: "FERMEE", dateFermeture: finJ },
        });
      }
    }

    // ── Vérifier qu'il n'y a pas de session OUVERTE aujourd'hui ────────────
    const existing = await prisma.sessionCaisse.findFirst({
      where: { statut: "OUVERTE" },
    });
    if (existing) {
      return NextResponse.json({ message: "Une session est déjà ouverte" }, { status: 409 });
    }

    const caissierNom = auth.user.name ?? `${auth.user.prenom} ${auth.user.nom}`;
    const caissierId  = parseInt(auth.user.id);

    // Trouver le PDV du caissier via affectation active
    const affectation = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: caissierId, actif: true },
      select: { pointDeVenteId: true },
    });

    const newSession = await prisma.sessionCaisse.create({
      data: {
        caissierNom,
        caissierId,
        pointDeVenteId: affectation?.pointDeVenteId ?? null,
        fondsCaisse:    new Prisma.Decimal(fondsCaisse),
        statut:         "OUVERTE",
        notes,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Session de caisse ouverte",
        data: {
          ...newSession,
          fondsCaisse:   Number(newSession.fondsCaisse),
          dateOuverture: newSession.dateOuverture.toISOString(),
          createdAt:     newSession.createdAt.toISOString(),
          updatedAt:     newSession.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/caissier/session error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
