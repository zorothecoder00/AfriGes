import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";
import { notifyAdmins } from "@/lib/notifications";

/**
 * GET — Souscriptions actives + en attente (vue caissier).
 *   ?search=nom&statut=ACTIF
 * POST — Crée une nouvelle souscription pour un client/membre.
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const statut = searchParams.get("statut");

    const souscriptions = await prisma.souscriptionPack.findMany({
      where: {
        statut: statut ? (statut as never) : { in: ["EN_ATTENTE", "ACTIF"] },
        ...(search
          ? {
              OR: [
                { user: { nom: { contains: search, mode: "insensitive" } } },
                { user: { prenom: { contains: search, mode: "insensitive" } } },
                { client: { nom: { contains: search, mode: "insensitive" } } },
                { client: { prenom: { contains: search, mode: "insensitive" } } },
                { client: { telephone: { contains: search } } },
              ],
            }
          : {}),
      },
      orderBy: [{ statut: "asc" }, { createdAt: "desc" }],
      include: {
        pack: { select: { nom: true, type: true, frequenceVersement: true } },
        user: { select: { nom: true, prenom: true, telephone: true } },
        client: { select: { nom: true, prenom: true, telephone: true } },
        _count: { select: { versements: true } },
        echeances: {
          where: { statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
          orderBy: { datePrevue: "asc" },
          take: 3,
        },
      },
    });

    // Packs actifs disponibles pour nouvelle souscription
    const packs = await prisma.pack.findMany({
      where: { actif: true },
      orderBy: { type: "asc" },
    });

    return NextResponse.json({ souscriptions, packs });
  } catch (error) {
    console.error("GET /api/caissier/packs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      packId,
      userId,
      clientId,
      formuleRevendeur,
      montantTotal,
      dateDebut,
      dateFin,
      notes,
      // Versement initial (acompte)
      acompteInitial,
    } = body;

    if (!packId || (!userId && !clientId)) {
      return NextResponse.json(
        { error: "packId et (userId ou clientId) sont obligatoires" },
        { status: 400 }
      );
    }
    if (userId && clientId) {
      return NextResponse.json(
        { error: "Indiquer userId OU clientId, pas les deux" },
        { status: 400 }
      );
    }
    if (!montantTotal || parseFloat(montantTotal) <= 0) {
      return NextResponse.json({ error: "montantTotal obligatoire et > 0" }, { status: 400 });
    }

    const pack = await prisma.pack.findUnique({ where: { id: parseInt(packId) } });
    if (!pack || !pack.actif) {
      return NextResponse.json({ error: "Pack introuvable ou inactif" }, { status: 404 });
    }

    const caissierNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
    const montantTotalNum = parseFloat(montantTotal);
    const acompteNum = acompteInitial ? parseFloat(acompteInitial) : 0;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Créer la souscription
      const souscription = await tx.souscriptionPack.create({
        data: {
          packId: parseInt(packId),
          userId: userId ? parseInt(userId) : null,
          clientId: clientId ? parseInt(clientId) : null,
          formuleRevendeur: formuleRevendeur ?? null,
          statut: acompteNum > 0 ? "ACTIF" : "EN_ATTENTE",
          montantTotal: montantTotalNum,
          montantVerse: acompteNum,
          montantRestant: montantTotalNum - acompteNum,
          dateDebut: dateDebut ? new Date(dateDebut) : new Date(),
          dateFin: dateFin ? new Date(dateFin) : null,
          notes,
          enregistrePar: caissierNom,
        },
      });

      // 2. Générer l'échéancier pour REVENDEUR F2 ou URGENCE
      if (
        (pack.type === "REVENDEUR" && formuleRevendeur === "FORMULE_2") ||
        pack.type === "URGENCE"
      ) {
        const duree = pack.dureeJours ?? 16;
        const montantRestant = montantTotalNum - acompteNum;
        const nbEcheances = duree;
        const montantEcheance = Math.ceil((montantRestant / nbEcheances) * 100) / 100;

        const debut = dateDebut ? new Date(dateDebut) : new Date();
        const echeances = Array.from({ length: nbEcheances }, (_, i) => {
          const date = new Date(debut);
          date.setDate(date.getDate() + i + 1);
          return {
            souscriptionId: souscription.id,
            numero: i + 1,
            montant: i === nbEcheances - 1
              ? montantRestant - montantEcheance * (nbEcheances - 1) // dernier arrondi
              : montantEcheance,
            datePrevue: date,
            statut: "EN_ATTENTE" as const,
          };
        });

        await tx.echeancePack.createMany({ data: echeances });
      }

      // 3. Enregistrer l'acompte initial si fourni
      if (acompteNum > 0) {
        await tx.versementPack.create({
          data: {
            souscriptionId: souscription.id,
            type: "COTISATION_INITIALE",
            montant: acompteNum,
            statut: "PAYE",
            datePaiement: new Date(),
            encaisseParId: parseInt(session.user.id),
            encaisseParNom: caissierNom,
            notes: `Acompte initial — ${pack.nom}`,
          },
        });
      }

      // 4. Notifier les admins
      await notifyAdmins(tx, {
        titre: `Nouvelle souscription — ${pack.nom}`,
        message: `${caissierNom} a enregistré une souscription au pack ${pack.nom} (${montantTotalNum.toLocaleString("fr-FR")} FCFA).`,
        priorite: "NORMAL",
        actionUrl: "/dashboard/user/packs",
      });

      return souscription;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/caissier/packs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
