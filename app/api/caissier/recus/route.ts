import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";

/**
 * GET /api/caissier/recus?venteId=XXX
 *
 * Retourne toutes les informations nécessaires à la génération d'un reçu :
 *  - Détails de la vente
 *  - Infos client / bénéficiaire
 *  - État du crédit alimentaire après la vente
 *  - Nom de l'application (depuis Parametre si disponible)
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const venteId = searchParams.get("venteId");

    if (!venteId) {
      return NextResponse.json({ message: "venteId requis" }, { status: 400 });
    }

    const vente = await prisma.venteCreditAlimentaire.findUnique({
      where: { id: Number(venteId) },
      include: {
        produit: { select: { id: true, nom: true, prixUnitaire: true, description: true } },
        creditAlimentaire: {
          select: {
            id: true,
            plafond: true,
            montantUtilise: true,
            montantRestant: true,
            statut: true,
            source: true,
            member: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
            client: { select: { id: true, nom: true, prenom: true, telephone: true } },
          },
        },
      },
    });

    if (!vente) {
      return NextResponse.json({ message: "Vente introuvable" }, { status: 404 });
    }

    const ca     = vente.creditAlimentaire;
    const person = ca?.client ?? ca?.member;
    const montantVente = Number(vente.prixUnitaire) * vente.quantite;

    // Paramètres app (nom entreprise, etc.)
    const params = await prisma.parametre.findMany({
      where: { cle: { in: ["APP_NOM", "APP_ADRESSE", "APP_TELEPHONE"] } },
    });
    const getParam = (cle: string) => params.find((p) => p.cle === cle)?.valeur ?? "";

    return NextResponse.json({
      success: true,
      data: {
        recu: {
          numero:    `REC-${String(vente.id).padStart(6, "0")}`,
          date:      vente.createdAt.toISOString(),
          caissier:  session.user.name ?? "Caissier",
        },
        vente: {
          id:           vente.id,
          produitNom:   vente.produit.nom,
          produitDesc:  vente.produit.description,
          quantite:     vente.quantite,
          prixUnitaire: Number(vente.prixUnitaire),
          montantTotal: montantVente,
        },
        client: {
          nom:        person ? `${person.prenom} ${person.nom}` : "—",
          telephone:  "telephone" in (person ?? {}) ? (person as { telephone?: string })?.telephone : undefined,
          email:      "email" in (person ?? {})     ? (person as { email?:     string })?.email     : undefined,
        },
        creditAlimentaire: ca
          ? {
              id:             ca.id,
              plafond:        Number(ca.plafond),
              montantUtilise: Number(ca.montantUtilise),
              montantRestant: Number(ca.montantRestant),
              statut:         ca.statut,
            }
          : null,
        entreprise: {
          nom:       getParam("APP_NOM")       || "AfriGes",
          adresse:   getParam("APP_ADRESSE")   || "",
          telephone: getParam("APP_TELEPHONE") || "",
        },
      },
    });
  } catch (error) {
    console.error("GET /api/caissier/recus error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
