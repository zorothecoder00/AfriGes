import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { enregistrerChangementPrix } from "@/lib/prixProduit";
import { auditLog } from "@/lib/notifications";
import { parseNombre } from "@/lib/catalogueImport";

/**
 * Import en masse de produits (Catalogue §17) — admin.
 * POST { mode: "dry-run" | "apply", cle?: "codeProduit" | "reference", rows: [...] }
 *  - dry-run : valide et simule (aucune écriture), renvoie le rapport ligne à ligne.
 *  - apply   : crée / met à jour les produits, auto-crée les référentiels manquants.
 * Le rapprochement create/update se fait sur `cle` (codeProduit par défaut).
 */

type Ligne = Record<string, string>;
type Action = "create" | "update" | "error";
interface Rapport { ligne: number; action: Action; nom: string; codeProduit: string | null; message: string; }

const lowerTrim = (s: string) => s.trim().toLowerCase();

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { mode?: string; cle?: string; rows?: Ligne[] } | null;
  if (!body || !Array.isArray(body.rows)) return NextResponse.json({ message: "Corps invalide" }, { status: 400 });

  const apply = body.mode === "apply";
  const cle = body.cle === "reference" ? "reference" : "codeProduit";
  const rows = body.rows.slice(0, 2000);
  if (rows.length === 0) return NextResponse.json({ message: "Aucune ligne à importer" }, { status: 400 });

  const userId = Number(session.user.id);

  // Référentiels existants (résolution par nom, insensible à la casse).
  const [familles, categories, marques, unites] = await Promise.all([
    prisma.familleProduit.findMany({ select: { id: true, nom: true } }),
    prisma.categorieProduit.findMany({ select: { id: true, nom: true } }),
    prisma.marqueProduit.findMany({ select: { id: true, nom: true } }),
    prisma.uniteProduit.findMany({ select: { id: true, nom: true } }),
  ]);
  const mapFamille = new Map(familles.map((f) => [lowerTrim(f.nom), f.id]));
  const mapCategorie = new Map(categories.map((c) => [lowerTrim(c.nom), c.id]));
  const mapMarque = new Map(marques.map((m) => [lowerTrim(m.nom), m.id]));
  const mapUnite = new Map(unites.map((u) => [lowerTrim(u.nom), u.id]));

  // Résout un référentiel par nom ; en mode apply, le crée s'il manque.
  async function resolveRef(
    nom: string | undefined,
    map: Map<string, number>,
    creer: (nom: string) => Promise<{ id: number }>,
  ): Promise<number | null> {
    if (!nom || !nom.trim()) return null;
    const key = lowerTrim(nom);
    const found = map.get(key);
    if (found) return found;
    if (!apply) return -1; // marqueur « sera créé »
    const created = await creer(nom.trim());
    map.set(key, created.id);
    return created.id;
  }

  const rapports: Rapport[] = [];
  let crees = 0, maj = 0, erreurs = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ligneNo = i + 1;
    const nom = (row.nom ?? "").trim();
    const cleVal = (row[cle] ?? "").trim();

    try {
      const existant = cleVal
        ? await prisma.produit.findFirst({
            where: cle === "codeProduit" ? { codeProduit: cleVal } : { reference: cleVal },
            select: { id: true, codeProduit: true, prixUnitaire: true, prixAchat: true },
          })
        : null;

      // Résolution des référentiels (auto-création en apply).
      const familleId = await resolveRef(row.famille, mapFamille, (n) => prisma.familleProduit.create({ data: { nom: n }, select: { id: true } }));
      const categorieId = await resolveRef(row.categorie, mapCategorie, (n) => prisma.categorieProduit.create({ data: { nom: n }, select: { id: true } }));
      const marqueId = await resolveRef(row.marque, mapMarque, (n) => prisma.marqueProduit.create({ data: { nom: n }, select: { id: true } }));
      const uniteVenteId = await resolveRef(row.uniteVente, mapUnite, (n) => prisma.uniteProduit.create({ data: { nom: n }, select: { id: true } }));

      const prixVente = parseNombre(row.prixUnitaire);
      const prixAchat = parseNombre(row.prixAchat);
      const alerteStock = parseNombre(row.alerteStock);

      // Champs communs (uniquement ceux fournis pour un update partiel).
      const champs: Prisma.ProduitUncheckedUpdateInput = {};
      if (row.nom) champs.nom = nom;
      if (row.nomCommercial !== undefined) champs.nomCommercial = row.nomCommercial || null;
      if (row.description !== undefined) champs.description = row.description || null;
      if (row.reference !== undefined) champs.reference = row.reference || null;
      if (row.codeBarre !== undefined) champs.codeBarre = row.codeBarre || null;
      if (prixAchat != null) champs.prixAchat = new Prisma.Decimal(prixAchat);
      if (alerteStock != null) champs.alerteStock = Math.round(alerteStock);
      if (familleId && familleId > 0) champs.familleId = familleId;
      if (categorieId && categorieId > 0) champs.categorieId = categorieId;
      if (marqueId && marqueId > 0) champs.marqueId = marqueId;
      if (uniteVenteId && uniteVenteId > 0) champs.uniteVenteId = uniteVenteId;

      if (existant) {
        // ── Mise à jour ────────────────────────────────────────────────────────
        if (prixVente != null) {
          if (prixVente <= 0) throw new Error("Prix vente invalide");
          champs.prixUnitaire = new Prisma.Decimal(prixVente);
        }
        if (apply) {
          await prisma.$transaction(async (tx) => {
            await tx.produit.update({ where: { id: existant.id }, data: champs });
            await enregistrerChangementPrix(tx, {
              produitId: existant.id,
              nouveauPrixVente: prixVente ?? undefined,
              nouveauPrixAchat: prixAchat != null ? new Prisma.Decimal(prixAchat) : undefined,
              source: "MANUEL", motif: "Import catalogue", userId,
            });
            await auditLog(tx, userId, "PRODUIT_IMPORT_MAJ", "Produit", existant.id);
          });
        }
        maj++;
        rapports.push({ ligne: ligneNo, action: "update", nom: nom || cleVal, codeProduit: existant.codeProduit, message: apply ? "Mis à jour" : "Sera mis à jour" });
      } else {
        // ── Création ─────────────────────────────────────────────────────────────
        if (!nom) throw new Error("Nom requis pour créer un produit");
        if (prixVente == null || prixVente <= 0) throw new Error("Prix vente requis (> 0) pour créer un produit");

        if (apply) {
          const code = await creerProduit({
            nom, prixVente, champs, referenceOverride: cle === "reference" ? cleVal : undefined, userId,
          });
          rapports.push({ ligne: ligneNo, action: "create", nom, codeProduit: code, message: "Créé" });
        } else {
          rapports.push({ ligne: ligneNo, action: "create", nom, codeProduit: cle === "codeProduit" ? cleVal || "(auto)" : null, message: "Sera créé" });
        }
        crees++;
      }
    } catch (e) {
      erreurs++;
      rapports.push({ ligne: ligneNo, action: "error", nom: nom || cleVal, codeProduit: cleVal || null, message: e instanceof Error ? e.message : "Erreur" });
    }
  }

  return NextResponse.json({
    data: { mode: apply ? "apply" : "dry-run", cle, resume: { total: rows.length, crees, maj, erreurs }, rapports },
  });
}

/** Crée un produit avec code auto-généré (retry P2002) et historique initial. */
async function creerProduit(args: {
  nom: string; prixVente: number; champs: Prisma.ProduitUncheckedUpdateInput;
  referenceOverride?: string; userId: number;
}): Promise<string> {
  const { nom, prixVente, champs, referenceOverride, userId } = args;
  for (let attempt = 0; attempt < 6; attempt++) {
    const count = await prisma.produit.count();
    const codeProduit = `PRD-${String(count + 1 + attempt).padStart(6, "0")}`;
    try {
      const created = await prisma.$transaction(async (tx) => {
        const p = await tx.produit.create({
          data: {
            ...(champs as unknown as Prisma.ProduitUncheckedCreateInput),
            nom,
            prixUnitaire: new Prisma.Decimal(prixVente),
            codeProduit,
            ...(referenceOverride ? { reference: referenceOverride } : {}),
          },
          select: { id: true, codeProduit: true, prixUnitaire: true, prixAchat: true },
        });
        await enregistrerChangementPrix(tx, {
          produitId: p.id, nouveauPrixVente: p.prixUnitaire, nouveauPrixAchat: p.prixAchat,
          initial: true, source: "INITIAL", motif: "Création (import catalogue)", userId,
        });
        await auditLog(tx, userId, "PRODUIT_IMPORT_CREE", "Produit", p.id);
        return p;
      });
      return created.codeProduit ?? codeProduit;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String(e.meta?.target ?? "");
        if (target.includes("codeProduit")) continue;
        if (target.includes("codeBarre")) throw new Error("Code-barres déjà utilisé");
        if (target.includes("reference")) throw new Error("Référence déjà utilisée");
      }
      throw e;
    }
  }
  throw new Error("Impossible de générer un code produit unique");
}
