import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { notifyRoles } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

async function getSession() {
  const admin = await getAdminSession();
  if (admin) return admin;
  const logistique = await getLogistiqueSession();
  if (logistique) return logistique;
  return null;
}

/**
 * POST /api/admin/souscriptions/lignes/[id]/creer-produit
 * Crée un nouveau produit dans le catalogue ET confirme la ligne en une seule transaction.
 * Utilisé quand un client demande un produit qui n'existe pas encore.
 *
 * Body:
 *   nom          — obligatoire
 *   prixUnitaire — obligatoire
 *   unite?
 *   categorie?
 *   prixAchat?
 *   description?
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const ligneId = parseInt(id);
    if (isNaN(ligneId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { nom, prixUnitaire, unite, categorie, prixAchat, description } = body as {
      nom: string;
      prixUnitaire: number;
      unite?: string;
      categorie?: string;
      prixAchat?: number;
      description?: string;
    };

    if (!nom?.trim()) return NextResponse.json({ error: "Le nom du produit est obligatoire" }, { status: 400 });
    if (!prixUnitaire || prixUnitaire <= 0) return NextResponse.json({ error: "prixUnitaire invalide" }, { status: 400 });

    const ligne = await prisma.ligneSouscriptionProduit.findUnique({
      where: { id: ligneId },
      include: {
        souscription: {
          select: {
            client: { select: { nom: true, prenom: true } },
            pack:   { select: { nom: true } },
          },
        },
        pointDeVente: { select: { nom: true } },
      },
    });
    if (!ligne) return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 });
    if (ligne.statut !== "EN_ATTENTE") {
      return NextResponse.json({ error: "Cette ligne a déjà été traitée" }, { status: 409 });
    }

    const adminId = parseInt(session.user.id);

    const { produit, ligneUpdated } = await prisma.$transaction(async (tx) => {
      // 1. Créer le produit dans le catalogue
      const produit = await tx.produit.create({
        data: {
          nom:         nom.trim(),
          prixUnitaire,
          unite:       unite?.trim() ?? null,
          categorie:   categorie?.trim() ?? null,
          prixAchat:   prixAchat ?? null,
          description: description?.trim() ?? null,
          actif:       true,
        },
      });

      // 2. Confirmer la ligne en la liant au nouveau produit
      const ligneUpdated = await tx.ligneSouscriptionProduit.update({
        where: { id: ligneId },
        data: {
          statut:         "CONFIRME",
          produitId:      produit.id,
          traiteParId:    adminId,
          dateTraitement: new Date(),
          notes:          `Produit créé depuis la demande client (${ligne.produitNomSaisi})`,
        },
      });

      // 3. Notifier magasinier + logistique du nouveau produit au catalogue
      const clientNom = ligne.souscription.client
        ? `${ligne.souscription.client.prenom} ${ligne.souscription.client.nom}`
        : "Client inconnu";
      const pdvNom    = ligne.pointDeVente?.nom ?? "PDV inconnu";
      await notifyRoles(tx, ["MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
        titre:    `Nouveau produit catalogue — ${produit.nom}`,
        message:  `Le produit "${produit.nom}" a été ajouté au catalogue suite à une demande de ${clientNom} (${pdvNom}).`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/logistique/produits`,
      });

      return { produit, ligneUpdated };
    });

    return NextResponse.json({ produit, ligne: ligneUpdated }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/souscriptions/lignes/[id]/creer-produit", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
