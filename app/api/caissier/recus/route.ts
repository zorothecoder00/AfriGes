import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";

/**
 * GET /api/caissier/recus?versementId=XXX
 *
 * Retourne toutes les informations nécessaires à la génération d'un reçu
 * pour un versement pack :
 *  - Détails du versement (montant, type, date)
 *  - Souscription associée (pack, solde avant/après)
 *  - Client / bénéficiaire
 *  - Nom de l'application (depuis Parametre si disponible)
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const versementId  = searchParams.get("versementId");
    const operationId  = searchParams.get("operationId");
    const venteId      = searchParams.get("venteId");

    if (!versementId && !operationId && !venteId) {
      return NextResponse.json({ message: "versementId, operationId ou venteId requis" }, { status: 400 });
    }

    // ── Reçu pour une vente directe ───────────────────────────────────────
    if (venteId) {
      const vente = await prisma.venteDirecte.findUnique({
        where: { id: Number(venteId) },
        include: {
          client:  { select: { nom: true, prenom: true, telephone: true } },
          vendeur: { select: { nom: true, prenom: true } },
          lignes:  { include: { produit: { select: { nom: true, unite: true } } } },
        },
      });
      if (!vente) {
        return NextResponse.json({ message: "Vente introuvable" }, { status: 404 });
      }

      const params = await prisma.parametre.findMany({
        where: { cle: { in: ["APP_NOM", "APP_ADRESSE", "APP_TELEPHONE"] } },
      });
      const getParam = (cle: string) => params.find((p) => p.cle === cle)?.valeur ?? "";

      const clientNomDisplay = vente.client
        ? `${vente.client.prenom} ${vente.client.nom}`
        : vente.clientNom ?? "—";

      return NextResponse.json({
        success: true,
        type: "vente_directe",
        data: {
          recu: {
            numero:   vente.reference,
            date:     vente.createdAt.toISOString(),
            caissier: vente.vendeur ? `${vente.vendeur.prenom} ${vente.vendeur.nom}` : "—",
          },
          vente: {
            id:            vente.id,
            reference:     vente.reference,
            montantTotal:  Number(vente.montantTotal),
            montantPaye:   Number(vente.montantPaye),
            monnaieRendue: Number(vente.monnaieRendue),
            modePaiement:  vente.modePaiement,
            notes:         vente.notes,
          },
          client: {
            nom:       clientNomDisplay,
            telephone: vente.client?.telephone ?? vente.clientTelephone ?? undefined,
          },
          lignes: vente.lignes.map((l) => ({
            produitNom:  l.produit.nom,
            unite:       l.produit.unite ?? "",
            quantite:    l.quantite,
            prixUnitaire: Number(l.prixUnitaire),
            montant:     Number(l.montant),
          })),
          entreprise: {
            nom:       getParam("APP_NOM")       || "AfriGes",
            adresse:   getParam("APP_ADRESSE")   || "",
            telephone: getParam("APP_TELEPHONE") || "",
          },
        },
      });
    }

    // ── Reçu pour une opération caisse (décaissement / encaissement) ──────
    if (operationId) {
      const operation = await prisma.operationCaisse.findUnique({
        where: { id: Number(operationId) },
      });
      if (!operation) {
        return NextResponse.json({ message: "Opération introuvable" }, { status: 404 });
      }

      const params = await prisma.parametre.findMany({
        where: { cle: { in: ["APP_NOM", "APP_ADRESSE", "APP_TELEPHONE"] } },
      });
      const getParam = (cle: string) => params.find((p) => p.cle === cle)?.valeur ?? "";

      const categorieLabel: Record<string, string> = {
        SALAIRE:     "Salaire",
        AVANCE:      "Avance sur salaire",
        FOURNISSEUR: "Paiement fournisseur",
        AUTRE:       "Autre dépense",
      };

      return NextResponse.json({
        success: true,
        type: "operation",
        data: {
          recu: {
            numero:   operation.reference,
            date:     operation.createdAt.toISOString(),
            caissier: operation.operateurNom,
          },
          operation: {
            montant:        Number(operation.montant),
            motif:          operation.motif,
            categorieLabel: categorieLabel[operation.categorie ?? "AUTRE"] ?? "Décaissement",
            reference:      operation.reference,
            type:           operation.type,
          },
          entreprise: {
            nom:       getParam("APP_NOM")       || "AfriGes",
            adresse:   getParam("APP_ADRESSE")   || "",
            telephone: getParam("APP_TELEPHONE") || "",
          },
        },
      });
    }

    const versement = await prisma.versementPack.findUnique({
      where: { id: Number(versementId) },
      include: {
        souscription: {
          include: {
            pack:   { select: { id: true, nom: true, type: true } },
            client: { select: { id: true, nom: true, prenom: true, telephone: true } },
            user:   { select: { id: true, nom: true, prenom: true, telephone: true } },
          },
        },
      },
    });

    if (!versement) {
      return NextResponse.json({ message: "Versement introuvable" }, { status: 404 });
    }

    const souscription = versement.souscription;
    const person = souscription.client ?? souscription.user;

    // Paramètres app (nom entreprise, etc.)
    const params = await prisma.parametre.findMany({
      where: { cle: { in: ["APP_NOM", "APP_ADRESSE", "APP_TELEPHONE"] } },
    });
    const getParam = (cle: string) => params.find((p) => p.cle === cle)?.valeur ?? "";

    const typeLabel: Record<string, string> = {
      COTISATION_INITIALE:  "Acompte initial",
      VERSEMENT_PERIODIQUE: "Versement périodique",
      REMBOURSEMENT:        "Remboursement",
      BONUS:                "Bonus",
      AJUSTEMENT:           "Ajustement",
    };

    return NextResponse.json({
      success: true,
      data: {
        recu: {
          numero:   `VER-${String(versement.id).padStart(6, "0")}`,
          date:     versement.datePaiement.toISOString(),
          caissier: versement.encaisseParNom ?? session.user.name ?? "Caissier",
        },
        versement: {
          id:        versement.id,
          montant:   Number(versement.montant),
          type:      versement.type,
          typeLabel: typeLabel[versement.type] ?? versement.type,
          notes:     versement.notes,
        },
        souscription: {
          packNom:        souscription.pack.nom,
          packType:       souscription.pack.type,
          montantTotal:   Number(souscription.montantTotal),
          montantVerse:   Number(souscription.montantVerse),
          montantRestant: Number(souscription.montantRestant),
          statut:         souscription.statut,
        },
        client: {
          nom:       person ? `${person.prenom} ${person.nom}` : "—",
          telephone: person && "telephone" in person
            ? (person as { telephone?: string }).telephone
            : undefined,
        },
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
