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
 * PATCH /api/admin/souscriptions/lignes/[id]
 * Traite une ligne produit de souscription.
 *
 * Cas 1 — CONFIRME, produit existant dans le catalogue :
 *   { statut: "CONFIRME", produitId: 42 }
 *   → produit.nom (catalogue) devient le nom canonique, la ligne alimente les prévisions
 *
 * Cas 2 — CONFIRME, produit inconnu (estNouveauProduit = true) :
 *   → Utiliser POST /api/admin/souscriptions/lignes/[id]/creer-produit à la place
 *
 * Cas 3 — INDISPONIBLE :
 *   { statut: "INDISPONIBLE", notes: "motif obligatoire" }
 *
 * Cas 4 — SUBSTITUE :
 *   { statut: "SUBSTITUE", produitSubstitutId: 55, notes?: "..." }
 *   → produitSubstitut.nom sera le produit livré à la place
 *
 * Body:
 *   statut              — "CONFIRME" | "INDISPONIBLE" | "SUBSTITUE" | "ANNULE"
 *   produitId?          — pour CONFIRME sur produit existant (si pas encore lié)
 *   produitSubstitutId? — obligatoire si SUBSTITUE
 *   notes?              — obligatoire si INDISPONIBLE
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const ligneId = parseInt(id);
    if (isNaN(ligneId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { statut, produitId, produitSubstitutId, notes } = body as {
      statut: "CONFIRME" | "INDISPONIBLE" | "SUBSTITUE" | "ANNULE";
      produitId?: number;
      produitSubstitutId?: number;
      notes?: string;
    };

    const statutsValides = ["CONFIRME", "INDISPONIBLE", "SUBSTITUE", "ANNULE"];
    if (!statutsValides.includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }
    if (statut === "INDISPONIBLE" && !notes?.trim()) {
      return NextResponse.json({ error: "Le motif (notes) est obligatoire pour INDISPONIBLE" }, { status: 400 });
    }
    if (statut === "SUBSTITUE" && !produitSubstitutId) {
      return NextResponse.json({ error: "produitSubstitutId est obligatoire pour SUBSTITUE" }, { status: 400 });
    }

    const ligne = await prisma.ligneSouscriptionProduit.findUnique({
      where: { id: ligneId },
      include: {
        souscription: {
          select: {
            id: true,
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

    // Pour CONFIRME sur produit inconnu → forcer l'utilisation de creer-produit
    if (statut === "CONFIRME" && ligne.estNouveauProduit && !ligne.produitId && !produitId) {
      return NextResponse.json(
        { error: "Ce produit n'existe pas dans le catalogue. Utilisez l'action 'Créer le produit' à la place." },
        { status: 422 }
      );
    }

    // Vérifier que le produit de substitution existe
    if (statut === "SUBSTITUE" && produitSubstitutId) {
      const produitSubstitut = await prisma.produit.findUnique({
        where: { id: produitSubstitutId, actif: true },
        select: { id: true },
      });
      if (!produitSubstitut) {
        return NextResponse.json({ error: "Produit de substitution introuvable dans le catalogue" }, { status: 400 });
      }
    }

    const adminId = parseInt(session.user.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      statut,
      traiteParId:    adminId,
      dateTraitement: new Date(),
      notes:          notes ?? null,
    };

    if (statut === "CONFIRME" && produitId)       updateData.produitId          = produitId;
    if (statut === "SUBSTITUE" && produitSubstitutId) updateData.produitSubstitutId = produitSubstitutId;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.ligneSouscriptionProduit.update({
        where: { id: ligneId },
        data:  updateData,
        include: {
          produit:          { select: { id: true, nom: true, unite: true } },
          produitSubstitut: { select: { id: true, nom: true, unite: true } },
        },
      });

      if (statut === "INDISPONIBLE" || statut === "SUBSTITUE") {
        const clientNom = ligne.souscription.client
          ? `${ligne.souscription.client.prenom} ${ligne.souscription.client.nom}`
          : "Client inconnu";
        const pdvNom    = ligne.pointDeVente?.nom ?? "PDV inconnu";
        const action    = statut === "INDISPONIBLE" ? "indisponible" : "substitué";

        await notifyRoles(tx, ["AGENT_TERRAIN"], {
          titre:    `Produit ${action} — ${ligne.produitNomSaisi}`,
          message:  `Le produit "${ligne.produitNomSaisi}" demandé par ${clientNom} (${pdvNom}) est ${action}.${notes ? ` Motif : ${notes}` : ""}`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl:`/dashboard/agent/packs`,
        });
      }

      return result;
    });

    return NextResponse.json({ ligne: updated });
  } catch (error) {
    console.error("PATCH /api/admin/souscriptions/lignes/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
