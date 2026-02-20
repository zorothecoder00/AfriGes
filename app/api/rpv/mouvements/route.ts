import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/rpv/mouvements
 * Journal de tous les mouvements de stock avec pagination et filtres.
 * Paramètres : page, limit, type (ENTREE|SORTIE|AJUSTEMENT), produitId, search
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page     = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit    = Math.min(50, Math.max(5, Number(searchParams.get("limit") ?? "20")));
    const type     = searchParams.get("type") ?? "";
    const produitId= searchParams.get("produitId") ?? "";
    const search   = searchParams.get("search") ?? "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (type)      where.type      = type;
    if (produitId) where.produitId = Number(produitId);
    if (search) {
      where.OR = [
        { motif:     { contains: search, mode: "insensitive" } },
        { reference: { contains: search, mode: "insensitive" } },
        { produit: { nom: { contains: search, mode: "insensitive" } } },
      ];
    }

    const il30j = new Date(); il30j.setDate(il30j.getDate() - 30);

    const [mouvements, total, statsRaw] = await Promise.all([
      prisma.mouvementStock.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { dateMouvement: "desc" },
        include: { produit: { select: { id: true, nom: true, stock: true, prixUnitaire: true } } },
      }),
      prisma.mouvementStock.count({ where }),
      prisma.mouvementStock.groupBy({
        by:    ["type"],
        _sum:  { quantite: true },
        _count:{ id: true },
        where: { dateMouvement: { gte: il30j } },
      }),
    ]);

    const stats: Record<string, { quantite: number; count: number }> = {};
    for (const s of statsRaw) {
      stats[s.type] = { quantite: s._sum.quantite ?? 0, count: s._count.id };
    }

    return NextResponse.json({
      success: true,
      data:  mouvements.map((m) => ({ ...m, dateMouvement: m.dateMouvement.toISOString() })),
      stats: {
        entrees30j:    stats["ENTREE"]    ?? { quantite: 0, count: 0 },
        sorties30j:    stats["SORTIE"]    ?? { quantite: 0, count: 0 },
        ajustements30j:stats["AJUSTEMENT"]?? { quantite: 0, count: 0 },
      },
      meta:  { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error("GET /api/rpv/mouvements error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/rpv/mouvements
 * Enregistre un mouvement de stock (entrée, sortie ou ajustement).
 * Body : { produitId, type, quantite, motif? }
 */
export async function POST(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { produitId, type, quantite, motif } = await req.json();

    if (!produitId || !type || quantite === undefined)
      return NextResponse.json({ message: "produitId, type et quantite sont requis" }, { status: 400 });

    if (!["ENTREE", "SORTIE", "AJUSTEMENT"].includes(type))
      return NextResponse.json({ message: "Type invalide (ENTREE|SORTIE|AJUSTEMENT)" }, { status: 400 });

    const qte = Number(quantite);
    if (isNaN(qte) || qte === 0)
      return NextResponse.json({ message: "La quantité ne peut pas être zéro" }, { status: 400 });
    if ((type === "ENTREE" || type === "SORTIE") && qte < 0)
      return NextResponse.json({ message: "La quantité doit être positive pour ENTREE/SORTIE" }, { status: 400 });

    const produit = await prisma.produit.findUnique({ where: { id: Number(produitId) } });
    if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

    const delta    = type === "SORTIE" ? -Math.abs(qte) : (type === "ENTREE" ? Math.abs(qte) : qte);
    const newStock = produit.stock + delta;
    if (newStock < 0)
      return NextResponse.json({ message: `Stock insuffisant (disponible : ${produit.stock})` }, { status: 400 });

    const prefix  = type === "ENTREE" ? "RPV-ENT" : type === "SORTIE" ? "RPV-SOR" : "RPV-ADJ";
    const result  = await prisma.$transaction(async (tx) => {
      const mv = await tx.mouvementStock.create({
        data: {
          produitId: Number(produitId),
          type,
          quantite:  Math.abs(qte),
          motif:     motif ?? `${type} RPV — ${session.user.name ?? "RPV"}`,
          reference: `${prefix}-${randomUUID()}`,
        },
      });
      await tx.produit.update({
        where: { id: Number(produitId) },
        data:  { stock: newStock, prixUnitaire: new Prisma.Decimal(Number(produit.prixUnitaire)) },
      });

      // Audit log
      await auditLog(tx, parseInt(session.user.id), `MOUVEMENT_STOCK_RPV_${type}`, "MouvementStock", mv.id);

      // Labels pour la notification
      const typeLabel = type === "ENTREE" ? "Entrée" : type === "SORTIE" ? "Sortie" : "Ajustement";
      const priorite  = PrioriteNotification.NORMAL;

      // Notifications : Admin + Magasinier + Logistique
      await notifyRoles(
        tx,
        ["MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"],
        {
          titre:    `${typeLabel} stock — ${produit.nom}`,
          message:  `${session.user.name ?? "RPV"} a enregistré un mouvement ${typeLabel.toLowerCase()} de ${Math.abs(qte)} unité(s) sur "${produit.nom}". Stock : ${produit.stock} → ${newStock}.${motif ? ` Motif : ${motif}` : ""}`,
          priorite,
          actionUrl: `/dashboard/admin/stock/${produitId}`,
        }
      );

      return mv;
    });

    return NextResponse.json(
      { success: true, message: "Mouvement enregistré", data: { ...result, dateMouvement: result.dateMouvement.toISOString(), stockApres: newStock } },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/rpv/mouvements error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
