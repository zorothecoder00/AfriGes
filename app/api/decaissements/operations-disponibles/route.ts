import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getComptableSession } from "@/lib/authComptable";

/**
 * GET /api/decaissements/operations-disponibles?jours=30&page=1&limit=10
 * Sorties de caisse (DECAISSEMENT) qui n'ont pas encore de fiche de décaissement.
 * La fiche vient APRÈS la sortie de caisse : c'est la liste dans laquelle on choisit
 * l'opération à justifier. Comptable/Chef Comptable/Admin : toutes ; sinon : celles
 * dont l'utilisateur est l'opérateur.
 * - jours : ne garde que les sorties des N derniers jours (0 = sans limite de date) ; défaut 30.
 * - categorie : filtre sur la catégorie de la sortie (ex. FOURNISSEUR pour les flux de paiement fournisseur) ;
 *   avec FOURNISSEUR, les profils approvisionnement voient les sorties de tous les opérateurs
 *   (ils rattachent la sortie faite par le caissier au bon de commande / règlement).
 * - page/limit : pagination sur l'ensemble grande caisse + petite caisse, plus récentes d'abord.
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const jours = Math.max(0, Number(searchParams.get("jours") ?? 30) || 0);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 10) || 10));

    const userId = parseInt(session.user.id);
    const categorie = searchParams.get("categorie");
    if (categorie && !["SALAIRE", "AVANCE", "FOURNISSEUR", "CARBURANT", "AUTRE"].includes(categorie)) {
      return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
    }
    const roleAppro = ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "RESPONSABLE_ACHATS"].includes(session.user.gestionnaireRole ?? "");
    const voitTout = !!(await getComptableSession()) || (categorie === "FOURNISSEUR" && roleAppro);
    const filtreOperateur = voitTout ? {} : { operateurId: userId };
    const filtreDate = jours > 0 ? { createdAt: { gte: new Date(Date.now() - jours * 86_400_000) } } : {};
    const filtreCategorie = categorie ? { categorie: categorie as "SALAIRE" | "AVANCE" | "FOURNISSEUR" | "CARBURANT" | "AUTRE" } : {};
    const where = { type: "DECAISSEMENT" as const, ficheDecaissement: null, ...filtreOperateur, ...filtreDate, ...filtreCategorie };

    // Pagination sur deux sources : on prend les (page × limit) plus récentes de chacune,
    // on fusionne, puis on découpe la page demandée.
    const [grandeCaisse, petiteCaisse, totalGrande, totalPetite] = await Promise.all([
      prisma.operationCaisse.findMany({
        where, orderBy: { createdAt: "desc" }, take: page * limit,
        include: {
          session: { select: { pointDeVente: { select: { id: true, nom: true, code: true } } } },
          beneficiaire: { select: { id: true, nom: true, prenom: true, telephone: true } },
        },
      }),
      prisma.operationCaissePDV.findMany({
        where, orderBy: { createdAt: "desc" }, take: page * limit,
        include: {
          caissePDV: { select: { pointDeVente: { select: { id: true, nom: true, code: true } } } },
          beneficiaire: { select: { id: true, nom: true, prenom: true, telephone: true } },
        },
      }),
      prisma.operationCaisse.count({ where }),
      prisma.operationCaissePDV.count({ where }),
    ]);

    const fusion = [
      ...grandeCaisse.map((o) => ({
        source: "CAISSE" as const, id: o.id, reference: o.reference, montant: Number(o.montant), motif: o.motif,
        categorie: o.categorie, mode: o.mode, date: o.createdAt, operateurNom: o.operateurNom,
        pointDeVente: o.session.pointDeVente, beneficiaire: o.beneficiaire,
      })),
      ...petiteCaisse.map((o) => ({
        source: "CAISSE_PDV" as const, id: o.id, reference: o.reference, montant: Number(o.montant), motif: o.motif,
        categorie: o.categorie, mode: o.mode, date: o.createdAt, operateurNom: o.operateurNom,
        pointDeVente: o.caissePDV.pointDeVente, beneficiaire: o.beneficiaire,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    const total = totalGrande + totalPetite;
    return NextResponse.json({
      data: fusion.slice((page - 1) * limit, page * limit),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), jours },
    });
  } catch (error) {
    console.error("GET /decaissements/operations-disponibles:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
