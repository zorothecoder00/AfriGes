import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/cron/fermeture-caisse
 *
 * Cron déclenché à 00:05 chaque nuit.
 * Ferme automatiquement toute session de caisse (OUVERTE ou SUSPENDUE)
 * qui n'a pas été clôturée manuellement avant minuit.
 *
 * Pour chaque session oubliée :
 *  1. Calcule les stats réelles de la journée correspondante
 *  2. Crée une ClotureCaisse (si absente) marquée "FERMETURE AUTOMATIQUE"
 *  3. Passe la SessionCaisse en FERMEE
 *  4. Notifie RPV + Admin
 *
 * Protégé par CRON_SECRET.
 */
export async function GET(req: Request) {
  try {
    // ── Auth cron ────────────────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret") || req.headers.get("authorization")?.replace("Bearer ", "");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const now          = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // ── Sessions oubliées (ouvertes avant aujourd'hui et toujours actives) ──
    const sessionsOubliees = await prisma.sessionCaisse.findMany({
      where: {
        statut:        { in: ["OUVERTE", "SUSPENDUE"] },
        dateOuverture: { lt: startOfToday },
      },
      orderBy: { dateOuverture: "asc" },
    });

    if (sessionsOubliees.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Aucune session à fermer automatiquement.",
        fermetures: 0,
      });
    }

    const rapport: { sessionId: number; caissierNom: string; date: string; action: string }[] = [];

    for (const session of sessionsOubliees) {
      // Jour de la session
      const d = session.dateOuverture;
      const debutJour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const finJour   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      // ── Créer la clôture si elle n'existe pas déjà ──────────────────────
      const cloturExistante = await prisma.clotureCaisse.findFirst({
        where: { sessionId: session.id, date: { gte: debutJour, lte: finJour } },
      });

      if (!cloturExistante) {
        // Calcul des stats du jour de la session
        const [versementsJour, encaissAgg, decaissAgg, transfertAgg] = await Promise.all([
          prisma.versementPack.findMany({
            where: { datePaiement: { gte: debutJour, lte: finJour } },
            include: { souscription: { select: { clientId: true, userId: true } } },
          }),
          prisma.operationCaisse.aggregate({
            _sum: { montant: true },
            where: { type: "ENCAISSEMENT", createdAt: { gte: debutJour, lte: finJour } },
          }),
          prisma.operationCaisse.aggregate({
            _sum: { montant: true },
            where: { type: "DECAISSEMENT", createdAt: { gte: debutJour, lte: finJour } },
          }),
          prisma.transfertCaisse.aggregate({
            _sum: { montant: true },
            where: { createdAt: { gte: debutJour, lte: finJour } },
          }),
        ]);

        const totalVentes  = versementsJour.length;
        const montantTotal = versementsJour.reduce((s, v) => s + Number(v.montant), 0);
        const panierMoyen  = totalVentes > 0 ? montantTotal / totalVentes : 0;

        const clientsSet = new Set(
          versementsJour
            .map((v) => {
              const s = v.souscription;
              return s.clientId ? `c${s.clientId}` : s.userId ? `u${s.userId}` : null;
            })
            .filter(Boolean)
        );
        const nbClients = clientsSet.size;

        const fondsCaisse              = Number(session.fondsCaisse);
        const totalEncaissementsAutres = Number(encaissAgg._sum.montant ?? 0);
        const totalDecaissements       = Number(decaissAgg._sum.montant ?? 0);
        const totalTransferts          = Number(transfertAgg._sum.montant ?? 0);
        const soldeTheorique           = fondsCaisse + montantTotal + totalEncaissementsAutres - totalDecaissements - totalTransferts;

        const dateStr = debutJour.toLocaleDateString("fr-FR");

        await prisma.$transaction(async (tx) => {
          const cloture = await tx.clotureCaisse.create({
            data: {
              date:                     debutJour,
              caissierNom:              session.caissierNom,
              totalVentes,
              montantTotal:             new Prisma.Decimal(montantTotal),
              panierMoyen:              new Prisma.Decimal(panierMoyen),
              nbClients,
              notes:                    `[FERMETURE AUTOMATIQUE MINUIT — ${now.toISOString()}] Caisse non clôturée manuellement.`,
              sessionId:                session.id,
              fondsCaisse:              new Prisma.Decimal(fondsCaisse),
              totalEncaissementsAutres: new Prisma.Decimal(totalEncaissementsAutres),
              totalDecaissements:       new Prisma.Decimal(totalDecaissements),
              totalTransferts:          new Prisma.Decimal(totalTransferts),
              soldeTheorique:           new Prisma.Decimal(soldeTheorique),
              soldeReel:                null,
              ecart:                    null,
            },
          });

          // Fermer la session
          await tx.sessionCaisse.update({
            where: { id: session.id },
            data:  { statut: "FERMEE", dateFermeture: finJour },
          });

          // Audit log (userId null car c'est le système)
          await auditLog(tx, null as unknown as number, "FERMETURE_AUTO_CAISSE", "ClotureCaisse", cloture.id);

          // Notification RPV + Admin
          await notifyRoles(
            tx,
            ["RESPONSABLE_POINT_DE_VENTE", "COMPTABLE"],
            {
              titre:    `⚠ Fermeture auto de caisse — ${dateStr}`,
              message:  `La caisse de ${session.caissierNom} du ${dateStr} a été fermée automatiquement à minuit (oubli de clôture). CA : ${montantTotal.toLocaleString("fr-FR")} FCFA.`,
              priorite: PrioriteNotification.HAUTE,
              actionUrl: "/dashboard/user/responsablesPointDeVente",
            }
          );
        });

        rapport.push({
          sessionId:   session.id,
          caissierNom: session.caissierNom,
          date:        dateStr,
          action:      "CLOTURE_ET_FERMETURE_AUTO",
        });
      } else {
        // Clôture déjà existante : juste fermer la session
        await prisma.sessionCaisse.update({
          where: { id: session.id },
          data:  { statut: "FERMEE", dateFermeture: finJour },
        });

        rapport.push({
          sessionId:   session.id,
          caissierNom: session.caissierNom,
          date:        debutJour.toLocaleDateString("fr-FR"),
          action:      "SESSION_FERMEE_CLOTURE_EXISTANTE",
        });
      }
    }

    return NextResponse.json({
      success:    true,
      message:    `${rapport.length} session(s) fermée(s) automatiquement.`,
      fermetures: rapport.length,
      detail:     rapport,
    });
  } catch (error) {
    console.error("CRON /fermeture-caisse error:", error);
    return NextResponse.json({ error: "Erreur lors de la fermeture automatique" }, { status: 500 });
  }
}
