import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getAuthSession } from "@/lib/auth";
import { auditLog, notifyRoles } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

async function getSession() {
  const logistique = await getLogistiqueSession();
  if (logistique) return logistique;
  const s = await getAuthSession();
  if (s && (s.user.role === "ADMIN" || s.user.role === "SUPER_ADMIN")) return s;
  return null;
}

/**
 * GET /api/logistique/produits/[id]
 * Fiche produit avec stock par PDV et historique mouvements récents.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const produit = await prisma.produit.findUnique({
      where: { id: Number(id) },
      include: {
        stocks: {
          include: { pointDeVente: { select: { id: true, nom: true, code: true, type: true } } },
        },
        mouvements: {
          orderBy: { dateMouvement: "desc" },
          take: 30,
          include: {
            pointDeVente: { select: { id: true, nom: true } },
            operateur:    { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
    });

    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const stockTotal = produit.stocks.reduce((acc, s) => acc + s.quantite, 0);
    const valeurTotale = stockTotal * Number(produit.prixUnitaire);

    return NextResponse.json({ data: { ...produit, stockTotal, valeurTotale } });
  } catch (error) {
    console.error("GET /logistique/produits/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/produits/[id]
 * Modifier un produit (nom, prix, catégorie, actif...).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const body = await req.json();
    const { nom, description, reference, categorie, unite, prixUnitaire, alerteStock, actif } = body;

    const existing = await prisma.produit.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    if (reference && reference !== existing.reference) {
      const taken = await prisma.produit.findUnique({ where: { reference } });
      if (taken) return NextResponse.json({ error: `La référence "${reference}" est déjà utilisée` }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.produit.update({
        where: { id: Number(id) },
        data: {
          ...(nom          !== undefined && { nom }),
          ...(description  !== undefined && { description }),
          ...(reference    !== undefined && { reference }),
          ...(categorie    !== undefined && { categorie }),
          ...(unite        !== undefined && { unite }),
          ...(alerteStock  !== undefined && { alerteStock: Number(alerteStock) }),
          ...(actif        !== undefined && { actif }),
          ...(prixUnitaire !== undefined && { prixUnitaire: new Prisma.Decimal(prixUnitaire) }),
        },
      });
      await auditLog(tx, parseInt(session.user.id), "PRODUIT_MODIFIE", "Produit", p.id);

      await notifyRoles(tx, ["MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
        titre:    `Produit modifié : ${p.nom}`,
        message:  `${session.user.prenom} ${session.user.nom} a modifié le produit "${p.nom}".`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/logistique/produits/${p.id}`,
      });

      return p;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /logistique/produits/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
