import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { resolveViewAs } from "@/lib/viewAs";

/**
 * GET /api/rpv/souscriptions-actives
 * Liste les souscriptions éligibles à une livraison pour les clients/membres du PDV du RPV.
 *
 * Règles d'éligibilité — strictement alignées sur /api/admin/packs/souscriptions/[id]/livrer :
 *  - URGENCE              → ACTIF ou COMPLETE
 *  - REVENDEUR FORMULE_1  → ACTIF ou COMPLETE
 *  - REVENDEUR FORMULE_2  → EN_ATTENTE, ACTIF ou COMPLETE
 *  - ALIMENTAIRE, FAMILIAL, EPARGNE_PRODUIT, FIDELITE, autres → COMPLETE uniquement
 *
 * Exclusion : souscription avec une réception PLANIFIEE déjà en cours.
 * Les livraisons passées (LIVREE) n'excluent PAS — seul le statut compte.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;
    const effectiveUserId = viewAs?.userId ?? parseInt(session.user.id);
    const pdv = await prisma.pointDeVente.findUnique({ where: { rpvId: effectiveUserId } });
    if (!pdv) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });

    const souscriptions = await prisma.souscriptionPack.findMany({
      where: {
        statut: { in: ["EN_ATTENTE", "ACTIF", "COMPLETE"] },
        OR: [
          // Client rattaché à ce PDV (association primaire)
          { client: { pointDeVenteId: pdv.id } },
          // Client rattaché à ce PDV (association secondaire multi-PDV)
          { client: { pointsDeVente: { some: { pointDeVenteId: pdv.id } } } },
          // Membre (User) affecté à ce PDV
          { user: { affectationsPDV: { some: { pointDeVenteId: pdv.id, actif: true } } } },
        ],
        // Pas de livraison déjà PLANIFIEE en attente
        receptions: { none: { statut: "PLANIFIEE" } },
      },
      include: {
        pack: {
          select: {
            nom: true,
            type: true,
            produitCible: { select: { id: true, nom: true, prixUnitaire: true } },
          },
        },
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        receptions: {
          where: { statut: "LIVREE" },
          select: {
            id: true,
            dateLivraison: true,
            lignes: { select: { quantite: true, prixUnitaire: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    /**
     * Règles d'éligibilité — strictement alignées sur /api/admin/packs/souscriptions/[id]/livrer :
     *
     *  URGENCE              → ACTIF ou COMPLETE
     *  REVENDEUR FORMULE_1  → ACTIF ou COMPLETE
     *  REVENDEUR FORMULE_2  → EN_ATTENTE, ACTIF ou COMPLETE (crédit total, toujours livrable)
     *  FAMILIAL             → COMPLETE uniquement (le cycle se réinitialise après chaque livraison)
     *  EPARGNE_PRODUIT      → COMPLETE uniquement
     *  ALIMENTAIRE          → COMPLETE uniquement
     *  FIDELITE / autres    → COMPLETE uniquement
     *
     * Aucune exclusion basée sur les livraisons passées : seul le statut compte.
     * (L'API de livraison vérifie elle-même le budget et les doublons PLANIFIEE.)
     */
    const eligibles = souscriptions.filter((s) => {
      switch (s.pack.type) {
        case "URGENCE":
          return ["ACTIF", "COMPLETE"].includes(s.statut);

        case "REVENDEUR":
          if (s.formuleRevendeur === "FORMULE_2") {
            return ["EN_ATTENTE", "ACTIF", "COMPLETE"].includes(s.statut);
          }
          // FORMULE_1 : acompte 50% requis → ACTIF ou COMPLETE
          return ["ACTIF", "COMPLETE"].includes(s.statut);

        default:
          // ALIMENTAIRE, FAMILIAL, EPARGNE_PRODUIT, FIDELITE, etc.
          return s.statut === "COMPLETE";
      }
    });

    return NextResponse.json({
      success: true,
      data: eligibles.map((s) => {
        // Pour FAMILIAL/EPARGNE_PRODUIT, le cycle se réinitialise après chaque livraison :
        // on ne compte que les réceptions du cycle actuel (dateLivraison >= dateDebut).
        // Pour les autres types, toutes les réceptions LIVREE sont comptées.
        const TYPES_CYCLE = ["FAMILIAL", "EPARGNE_PRODUIT"];
        const receptionsRef = TYPES_CYCLE.includes(s.pack.type)
          ? s.receptions.filter(
              (r) => r.dateLivraison != null && new Date(r.dateLivraison) >= new Date(s.dateDebut)
            )
          : s.receptions;

        const montantDejaLivre = receptionsRef.reduce(
          (sum, r) => sum + r.lignes.reduce((s2, l) => s2 + Number(l.prixUnitaire) * l.quantite, 0),
          0
        );
        return {
          id:               s.id,
          statut:           s.statut,
          montantTotal:     Number(s.montantTotal),
          montantVerse:     Number(s.montantVerse),
          montantRestant:   Number(s.montantRestant),
          montantDejaLivre,
          pack: {
            nom:          s.pack.nom,
            type:         s.pack.type,
            produitCible: s.pack.produitCible
              ? { id: s.pack.produitCible.id, nom: s.pack.produitCible.nom, prixUnitaire: Number(s.pack.produitCible.prixUnitaire) }
              : null,
          },
          client: s.client
            ? { id: s.client.id, nom: s.client.nom, prenom: s.client.prenom, telephone: s.client.telephone }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("GET /api/rpv/souscriptions-actives", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
