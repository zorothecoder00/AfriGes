import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { notifyAdmins, notifyRoles, notify, auditLog } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — Planifie la livraison du produit pour une souscription.
 * Body: { action: "planifier", lignes: [{produitId, quantite, prixUnitaire}], datePrevisionnelle?, livreurNom?, notes? }
 *
 * - "planifier" : crée une ReceptionProduitPack PLANIFIEE avec les lignes et notifie le magasinier
 *   La confirmation de la sortie stock (LIVREE + décrémentation) est réservée au magasinier.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const souscriptionId = parseInt(id);
    const body = await req.json();
    const { action, lignes, datePrevisionnelle, livreurNom, notes } = body;

    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: souscriptionId },
      include: { pack: true },
    });

    if (!souscription) {
      return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    }

    const rpvNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    // Récupère le PDV du RPV (il est responsable d'un seul PDV)
    const rpvPdv = await prisma.pointDeVente.findFirst({
      where: { rpvId: parseInt(session.user.id) },
      select: { id: true, nom: true },
    });

    if (action === "planifier") {
      if (!lignes || lignes.length === 0) {
        return NextResponse.json({ error: "Au moins une ligne de produit requise" }, { status: 400 });
      }

      const reception = await prisma.$transaction(async (tx) => {
        const rec = await tx.receptionProduitPack.create({
          data: {
            souscriptionId,
            statut: "PLANIFIEE",
            datePrevisionnelle: datePrevisionnelle ? new Date(datePrevisionnelle) : new Date(),
            livreurNom: livreurNom ?? null,
            notes,
            ...(rpvPdv ? { pointDeVenteId: rpvPdv.id } : {}),
            lignes: {
              create: lignes.map((l: { produitId: number; quantite: number; prixUnitaire: number }) => ({
                produitId: l.produitId,
                quantite: l.quantite,
                prixUnitaire: l.prixUnitaire,
              })),
            },
          },
          include: { lignes: { include: { produit: { select: { nom: true } } } } },
        });

        // Notifier les magasiniers du PDV du RPV
        if (rpvPdv) {
          const magasiniers = await tx.user.findMany({
            where: {
              gestionnaire: { role: "MAGAZINIER", actif: true },
              affectationsPDV: { some: { pointDeVenteId: rpvPdv.id, actif: true } },
            },
            select: { id: true },
          });
          if (magasiniers.length > 0) {
            await notify(tx, magasiniers.map(u => u.id), {
              titre: `Sortie stock à préparer — ${souscription.pack.nom}`,
              message: `${rpvNom} a planifié une livraison (souscription #${souscriptionId}) sur le PDV "${rpvPdv.nom}". Confirmez la sortie des produits.`,
              priorite: PrioriteNotification.HAUTE,
              actionUrl: "/dashboard/user/magasiniers",
            });
          }
        } else {
          await notifyRoles(tx, ["MAGAZINIER"], {
            titre: `Sortie stock à préparer — ${souscription.pack.nom}`,
            message: `${rpvNom} a planifié une livraison (souscription #${souscriptionId}). Préparez la sortie des produits depuis votre stock.`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: "/dashboard/user/magasiniers",
          });
        }

        await notifyAdmins(tx, {
          titre: `Livraison planifiée — ${souscription.pack.nom}`,
          message: `Une livraison de produits pour la souscription #${souscriptionId} a été planifiée par ${rpvNom}${rpvPdv ? ` (PDV : ${rpvPdv.nom})` : ""}.`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/user/packs",
        });

        await auditLog(tx, parseInt(session.user.id), "LIVRAISON_PACK_PLANIFIEE", "ReceptionProduitPack", rec.id);

        return rec;
      });

      return NextResponse.json(reception, { status: 201 });
    }

    return NextResponse.json({ error: "Action invalide : seule l'action 'planifier' est autorisée" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/rpv/packs/[id]/livrer", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
