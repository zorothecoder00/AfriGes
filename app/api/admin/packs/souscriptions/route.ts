import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notifications";

/**
 * GET — Toutes les souscriptions avec filtres optionnels :
 *   ?statut=ACTIF&type=REVENDEUR&search=jean
 * POST — Crée une nouvelle souscription client.
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const typePack = searchParams.get("type");
    const search = searchParams.get("search");

    const souscriptions = await prisma.souscriptionPack.findMany({
      where: {
        // Bug #2: support statuts multiples séparés par virgule (ex: "ACTIF,COMPLETE")
        ...(statut
          ? statut.includes(",")
            ? { statut: { in: statut.split(",") as never[] } }
            : { statut: statut as never }
          : {}),
        ...(typePack ? { pack: { type: typePack as never } } : {}),
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
      orderBy: { createdAt: "desc" },
      include: {
        pack: { select: { nom: true, type: true } },
        user: { select: { nom: true, prenom: true, telephone: true } },
        client: { select: { nom: true, prenom: true, telephone: true } },
        _count: { select: { versements: true, echeances: true, receptions: true } },
        // Bug #2: inclure seulement les réceptions LIVREE pour filtrer correctement dans TabLivraisons
        receptions: {
          where: { statut: "LIVREE" },
          select: { id: true },
        },
        echeances: {
          where: { statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
          orderBy: { datePrevue: "asc" },
          take: 1,
        },
      },
    });

    const stats = await prisma.souscriptionPack.groupBy({
      by: ["statut"],
      _count: true,
      _sum: { montantVerse: true, montantTotal: true },
    });

    return NextResponse.json({ souscriptions, stats });
  } catch (error) {
    console.error("GET /api/admin/packs/souscriptions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await req.json();
    const {
      packId,
      userId,
      clientId,
      formuleRevendeur,
      frequenceVersement,
      montantTotal,
      acompteInitial,
      dateDebut,
      dateFin,
      notes,
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

    const adminNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
    const montantTotalNum = parseFloat(montantTotal);
    const acompteNum = acompteInitial ? parseFloat(acompteInitial) : 0;

    // Bug #7: Validation acompte minimum pour URGENCE
    if (pack.type === "URGENCE" && pack.acomptePercent) {
      const minAcompte = (montantTotalNum * Number(pack.acomptePercent)) / 100;
      if (acompteNum < minAcompte) {
        return NextResponse.json(
          {
            error: `Acompte minimum requis pour un Pack Urgence : ${Math.ceil(minAcompte).toLocaleString("fr-FR")} FCFA (${pack.acomptePercent}% du montant total)`,
          },
          { status: 400 }
        );
      }
    }

    // Statut initial selon le type de pack et l'acompte versé
    let statutInitial: string = "EN_ATTENTE";
    if (acompteNum > 0) {
      if (pack.type === "REVENDEUR" && formuleRevendeur === "FORMULE_1" && pack.acomptePercent) {
        // F1 : ACTIF seulement si l'acompte atteint 50% du montant total
        const seuil50 = (montantTotalNum * Number(pack.acomptePercent)) / 100;
        statutInitial = acompteNum >= seuil50 ? "ACTIF" : "EN_ATTENTE";
      } else {
        statutInitial = "ACTIF";
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const souscription = await tx.souscriptionPack.create({
        data: {
          packId: parseInt(packId),
          userId: userId ? parseInt(userId) : null,
          clientId: clientId ? parseInt(clientId) : null,
          formuleRevendeur: formuleRevendeur ?? null,
          // Bug #10: stocker la fréquence override si fournie (FAMILIAL)
          frequenceVersement: frequenceVersement ?? null,
          statut: statutInitial as never,
          montantTotal: montantTotalNum,
          montantVerse: acompteNum,
          montantRestant: montantTotalNum - acompteNum,
          dateDebut: dateDebut ? new Date(dateDebut) : new Date(),
          dateFin: dateFin ? new Date(dateFin) : null,
          notes,
          enregistrePar: adminNom,
        },
      });

      const debut = dateDebut ? new Date(dateDebut) : new Date();
      const montantRestant = montantTotalNum - acompteNum;

      // ────────────────────────────────────────────────────────────────────────
      // Bug #8: Échéancier ALIMENTAIRE — cotisation périodique jusqu'au seuil
      // ────────────────────────────────────────────────────────────────────────
      if (pack.type === "ALIMENTAIRE") {
        const duree = pack.dureeJours ?? 30;
        const freq = pack.frequenceVersement;
        const step =
          freq === "QUOTIDIEN" ? 1 :
          freq === "HEBDOMADAIRE" ? 7 :
          freq === "BIMENSUEL" ? 14 :
          30; // MENSUEL
        const count = Math.ceil(duree / step);
        const montantEcheance = Math.round((montantTotalNum / count) * 100) / 100;

        const echeances = Array.from({ length: count }, (_, i) => {
          const date = new Date(debut);
          date.setDate(date.getDate() + (i + 1) * step);
          return {
            souscriptionId: souscription.id,
            numero: i + 1,
            montant:
              i === count - 1
                ? Math.round((montantTotalNum - montantEcheance * (count - 1)) * 100) / 100
                : montantEcheance,
            datePrevue: date,
            statut: "EN_ATTENTE" as const,
          };
        });
        await tx.echeancePack.createMany({ data: echeances });
      }

      // ────────────────────────────────────────────────────────────────────────
      // Bug #10: Échéancier FAMILIAL — fréquence choisie à la souscription
      // ────────────────────────────────────────────────────────────────────────
      else if (pack.type === "FAMILIAL") {
        const duree = pack.dureeJours ?? 30;
        const freq = frequenceVersement ?? pack.frequenceVersement ?? "HEBDOMADAIRE";
        const step =
          freq === "QUOTIDIEN" ? 1 :
          freq === "HEBDOMADAIRE" ? 7 :
          freq === "BIMENSUEL" ? 14 :
          30; // MENSUEL
        const count = Math.ceil(duree / step);
        const montantEcheance = Math.round((montantTotalNum / count) * 100) / 100;

        const echeances = Array.from({ length: count }, (_, i) => {
          const date = new Date(debut);
          date.setDate(date.getDate() + (i + 1) * step);
          return {
            souscriptionId: souscription.id,
            numero: i + 1,
            montant:
              i === count - 1
                ? Math.round((montantTotalNum - montantEcheance * (count - 1)) * 100) / 100
                : montantEcheance,
            datePrevue: date,
            statut: "EN_ATTENTE" as const,
          };
        });
        await tx.echeancePack.createMany({ data: echeances });
      }

      // ────────────────────────────────────────────────────────────────────────
      // Bug #3 + fix: Échéancier URGENCE — remboursement quotidien 7-10 jours
      // ────────────────────────────────────────────────────────────────────────
      else if (pack.type === "URGENCE") {
        // Bug #3: durée défaut URGENCE = 10 jours (pas 16)
        const duree = pack.dureeJours ?? 10;
        const montantEcheance = Math.round((montantRestant / duree) * 100) / 100;

        const echeances = Array.from({ length: duree }, (_, i) => {
          const date = new Date(debut);
          date.setDate(date.getDate() + i + 1);
          return {
            souscriptionId: souscription.id,
            numero: i + 1,
            montant:
              i === duree - 1
                ? Math.round((montantRestant - montantEcheance * (duree - 1)) * 100) / 100
                : montantEcheance,
            datePrevue: date,
            statut: "EN_ATTENTE" as const,
          };
        });
        await tx.echeancePack.createMany({ data: echeances });
      }

      // ────────────────────────────────────────────────────────────────────────
      // EPARGNE_PRODUIT — échéancier périodique jusqu'au seuil d'épargne
      // ────────────────────────────────────────────────────────────────────────
      else if (pack.type === "EPARGNE_PRODUIT" && pack.montantVersement && Number(pack.montantVersement) > 0) {
        const freq = pack.frequenceVersement ?? "MENSUEL";
        const step =
          freq === "QUOTIDIEN" ? 1 :
          freq === "HEBDOMADAIRE" ? 7 :
          freq === "BIMENSUEL" ? 14 :
          30; // MENSUEL
        const epargneParEcheance = Number(pack.montantVersement);
        // Nombre d'échéances pour atteindre le montant total
        const count = Math.ceil(montantTotalNum / epargneParEcheance);

        const echeances = Array.from({ length: count }, (_, i) => {
          const date = new Date(debut);
          date.setDate(date.getDate() + (i + 1) * step);
          return {
            souscriptionId: souscription.id,
            numero: i + 1,
            montant:
              i === count - 1
                ? Math.round((montantTotalNum - epargneParEcheance * (count - 1)) * 100) / 100
                : epargneParEcheance,
            datePrevue: date,
            statut: "EN_ATTENTE" as const,
          };
        });
        await tx.echeancePack.createMany({ data: echeances });
      }

      // ────────────────────────────────────────────────────────────────────────
      // REVENDEUR F2 — remboursement quotidien sur 16 jours max
      // ────────────────────────────────────────────────────────────────────────
      else if (pack.type === "REVENDEUR" && formuleRevendeur === "FORMULE_2") {
        const duree = pack.dureeJours ?? 16;
        const montantEcheance = Math.round((montantRestant / duree) * 100) / 100;

        const echeances = Array.from({ length: duree }, (_, i) => {
          const date = new Date(debut);
          date.setDate(date.getDate() + i + 1);
          return {
            souscriptionId: souscription.id,
            numero: i + 1,
            montant:
              i === duree - 1
                ? Math.round((montantRestant - montantEcheance * (duree - 1)) * 100) / 100
                : montantEcheance,
            datePrevue: date,
            statut: "EN_ATTENTE" as const,
          };
        });
        await tx.echeancePack.createMany({ data: echeances });
      }

      // ────────────────────────────────────────────────────────────────────────
      // Bug #4: REVENDEUR F1 — tontine hebdomadaire sur le solde restant après 50%
      // ────────────────────────────────────────────────────────────────────────
      else if (pack.type === "REVENDEUR" && formuleRevendeur === "FORMULE_1") {
        const duree = pack.dureeJours ?? 56; // 8 semaines par défaut
        const step = 7; // hebdomadaire
        const count = Math.ceil(duree / step);
        const montantEcheance = Math.round((montantRestant / count) * 100) / 100;

        const echeances = Array.from({ length: count }, (_, i) => {
          const date = new Date(debut);
          date.setDate(date.getDate() + (i + 1) * step);
          return {
            souscriptionId: souscription.id,
            numero: i + 1,
            montant:
              i === count - 1
                ? Math.round((montantRestant - montantEcheance * (count - 1)) * 100) / 100
                : montantEcheance,
            datePrevue: date,
            statut: "EN_ATTENTE" as const,
          };
        });
        await tx.echeancePack.createMany({ data: echeances });
      }

      // Enregistrer l'acompte
      if (acompteNum > 0) {
        await tx.versementPack.create({
          data: {
            souscriptionId: souscription.id,
            type: "COTISATION_INITIALE",
            montant: acompteNum,
            statut: "PAYE",
            datePaiement: new Date(),
            encaisseParId: parseInt(session.user.id),
            encaisseParNom: adminNom,
            notes: `Acompte initial — ${pack.nom}`,
          },
        });
      }

      await notifyAdmins(tx, {
        titre: `Nouvelle souscription — ${pack.nom}`,
        message: `${adminNom} a créé une souscription au pack ${pack.nom} (${montantTotalNum.toLocaleString("fr-FR")} FCFA).`,
        priorite: "NORMAL",
        actionUrl: "/dashboard/admin/packs",
      });

      return souscription;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/packs/souscriptions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
