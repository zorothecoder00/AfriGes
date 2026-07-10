import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * Export du catalogue (Catalogue §18) — admin.
 * GET ?format=json|csv[&statut=ACTIF]
 *  - json : payload structuré (intégration ERP / API).
 *  - csv  : fichier téléchargeable (colonnes canoniques, séparateur « ; »).
 */
export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "json";
  const statut = searchParams.get("statut");

  const where: Prisma.ProduitWhereInput = statut ? { statut: statut as Prisma.ProduitWhereInput["statut"] } : {};
  const produits = await prisma.produit.findMany({
    where,
    orderBy: { codeProduit: "asc" },
    select: {
      id: true, codeProduit: true, reference: true, nom: true, nomCommercial: true, description: true,
      codeBarre: true, prixUnitaire: true, prixAchat: true, alerteStock: true, statut: true,
      famille: { select: { nom: true } }, categorieProduit: { select: { nom: true } },
      marque: { select: { nom: true } }, uniteVente: { select: { nom: true } },
    },
  });

  const rows = produits.map((p) => ({
    codeProduit: p.codeProduit ?? "",
    reference: p.reference ?? "",
    nom: p.nom,
    nomCommercial: p.nomCommercial ?? "",
    description: p.description ?? "",
    codeBarre: p.codeBarre ?? "",
    prixUnitaire: Number(p.prixUnitaire),
    prixAchat: p.prixAchat != null ? Number(p.prixAchat) : "",
    alerteStock: p.alerteStock,
    famille: p.famille?.nom ?? "",
    categorie: p.categorieProduit?.nom ?? "",
    marque: p.marque?.nom ?? "",
    uniteVente: p.uniteVente?.nom ?? "",
    statut: p.statut,
  }));

  if (format === "json") {
    return NextResponse.json({ genere: new Date().toISOString(), total: rows.length, data: rows });
  }

  // CSV (séparateur « ; », compatible Excel FR ; échappe guillemets/retours).
  const entetes = Object.keys(rows[0] ?? {
    codeProduit: "", reference: "", nom: "", nomCommercial: "", description: "", codeBarre: "",
    prixUnitaire: "", prixAchat: "", alerteStock: "", famille: "", categorie: "", marque: "", uniteVente: "", statut: "",
  });
  const echapper = (v: unknown) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lignes = [entetes.join(";"), ...rows.map((r) => entetes.map((k) => echapper((r as Record<string, unknown>)[k])).join(";"))];
  const csv = "﻿" + lignes.join("\r\n"); // BOM UTF-8 pour Excel

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="catalogue-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
