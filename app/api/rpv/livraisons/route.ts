import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/rpv/livraisons
 * Liste les livraisons avec pagination et filtres.
 * Paramètres : page, limit, statut, type, search
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit  = Math.min(50, Math.max(5, Number(searchParams.get("limit") ?? "10")));
    const statut = searchParams.get("statut") ?? "";
    const type   = searchParams.get("type") ?? "";
    const search = searchParams.get("search") ?? "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (type)   where.type   = type;
    if (search) {
      where.OR = [
        { reference:       { contains: search, mode: "insensitive" } },
        { fournisseurNom:  { contains: search, mode: "insensitive" } },
        { destinataireNom: { contains: search, mode: "insensitive" } },
        { planifiePar:     { contains: search, mode: "insensitive" } },
      ];
    }

    const [livraisons, total, statsRaw] = await Promise.all([
      prisma.livraison.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { datePrevisionnelle: "asc" },
        include: {
          lignes: {
            include: { produit: { select: { id: true, nom: true, prixUnitaire: true } } },
          },
        },
      }),
      prisma.livraison.count({ where }),
      prisma.livraison.groupBy({ by: ["statut"], _count: { id: true } }),
    ]);

    const stats: Record<string, number> = {};
    for (const s of statsRaw) stats[s.statut] = s._count.id;

    return NextResponse.json({
      success: true,
      data: livraisons.map((l) => ({
        ...l,
        datePrevisionnelle: l.datePrevisionnelle.toISOString(),
        dateLivraison:      l.dateLivraison?.toISOString() ?? null,
        createdAt:          l.createdAt.toISOString(),
        updatedAt:          l.updatedAt.toISOString(),
      })),
      stats: {
        enAttente: stats["EN_ATTENTE"] ?? 0,
        enCours:   stats["EN_COURS"]   ?? 0,
        livrees:   stats["LIVREE"]     ?? 0,
        annulees:  stats["ANNULEE"]    ?? 0,
      },
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error("GET /api/rpv/livraisons error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/rpv/livraisons
 * Planifie une nouvelle livraison.
 * Body : {
 *   type: "RECEPTION" | "EXPEDITION",
 *   fournisseurNom?  (RECEPTION)
 *   destinataireNom? (EXPEDITION)
 *   datePrevisionnelle: ISO string,
 *   notes?,
 *   lignes: [{ produitId, quantitePrevue }]
 * }
 */
export async function POST(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { type, fournisseurNom, destinataireNom, datePrevisionnelle, notes, lignes } = await req.json();

    if (!type || !datePrevisionnelle || !lignes?.length) {
      return NextResponse.json(
        { message: "type, datePrevisionnelle et au moins une ligne sont requis" },
        { status: 400 }
      );
    }
    if (!["RECEPTION", "EXPEDITION"].includes(type))
      return NextResponse.json({ message: "Type invalide (RECEPTION|EXPEDITION)" }, { status: 400 });

    // Vérifier que les produits existent
    const produitIds = lignes.map((l: { produitId: number }) => Number(l.produitId));
    const produits = await prisma.produit.findMany({
      where: { id: { in: produitIds } },
      select: { id: true, stock: true },
    });
    if (produits.length !== produitIds.length)
      return NextResponse.json({ message: "Un ou plusieurs produits introuvables" }, { status: 404 });

    // Pour une EXPEDITION, vérifier que le stock est suffisant
    if (type === "EXPEDITION") {
      for (const l of lignes) {
        const p = produits.find((p) => p.id === Number(l.produitId));
        if (!p || p.stock < Number(l.quantitePrevue))
          return NextResponse.json({ message: `Stock insuffisant pour le produit #${l.produitId}` }, { status: 400 });
      }
    }

    const reference = `LIV-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    const livraison = await prisma.$transaction(async (tx) => {
      const created = await tx.livraison.create({
        data: {
          reference,
          type,
          statut:            "EN_ATTENTE",
          fournisseurNom:    fournisseurNom  ?? null,
          destinataireNom:   destinataireNom ?? null,
          datePrevisionnelle: new Date(datePrevisionnelle),
          notes:             notes ?? null,
          planifiePar:       session.user.name ?? "RPV",
          lignes: {
            create: lignes.map((l: { produitId: number; quantitePrevue: number }) => ({
              produitId:     Number(l.produitId),
              quantitePrevue: Number(l.quantitePrevue),
            })),
          },
        },
        include: {
          lignes: { include: { produit: { select: { id: true, nom: true } } } },
        },
      });

      // Audit log
      await auditLog(tx, parseInt(session.user.id), "PLANIFICATION_LIVRAISON_RPV", "Livraison", created.id);

      // Résumé des lignes pour le message
      const lignesStr = created.lignes.map((l) => `${l.quantitePrevue}× ${l.produit.nom}`).join(", ");
      const typeLabel = type === "RECEPTION" ? "réception" : "expédition";
      const tiers     = type === "RECEPTION" ? fournisseurNom : destinataireNom;

      // Notifications : Admin + Magasinier + Logistique
      await notifyRoles(
        tx,
        ["MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"],
        {
          titre:    `Livraison planifiée (${typeLabel})`,
          message:  `${session.user.name ?? "RPV"} a planifié une ${typeLabel}${tiers ? ` avec "${tiers}"` : ""} pour le ${new Date(datePrevisionnelle).toLocaleDateString("fr-FR")}. Réf : ${reference}. Produits : ${lignesStr}.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/responsablesPointDeVente`,
        }
      );

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Livraison planifiée avec succès",
        data: {
          ...livraison,
          datePrevisionnelle: livraison.datePrevisionnelle.toISOString(),
          createdAt:          livraison.createdAt.toISOString(),
          updatedAt:          livraison.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/rpv/livraisons error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
