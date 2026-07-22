import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { getAuthSession } from "@/lib/auth";
import { auditLog } from "@/lib/notifications";
import { formatRibComplet, extraireMetaRequete } from "@/lib/compteCourant";

type Ctx = { params: Promise<{ id: string }> };

const TYPES_COMPTE = new Set(["INDIVIDUEL", "MENAGE", "COMMUNAUTE", "GROUPEMENT"]);

/**
 * GET /api/comptes-courants/[id]
 * Détail d'un compte courant (CDC §6 — Consultation) — capacité READ.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const compteId = Number(id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: {
      id: true, numeroCompte: true, ribComplet: true, cleRib: true,
      codeAgence: true, codeGuichet: true, statut: true, motifBlocage: true,
      typeCompte: true, libelle: true,
      solde: true, totalDepose: true, totalRetire: true, totalUtilise: true,
      nbMouvements: true, dateOuverture: true, derniereOperationAt: true,
      createdAt: true,
      client: {
        select: {
          id: true, nom: true, prenom: true, telephone: true, telephoneSecondaire: true,
          codeClient: true, quartier: true, ville: true, commune: true, adresse: true,
          photoUrl: true, etat: true, segment: true,
          agentTerrain: { select: { id: true, nom: true, prenom: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
        },
      },
      membres: {
        orderBy: { role: "asc" },
        select: {
          id: true, role: true, quotePart: true, createdAt: true,
          client: {
            select: { id: true, nom: true, prenom: true, telephone: true, codeClient: true, photoUrl: true },
          },
        },
      },
      agentCreateur: { select: { id: true, nom: true, prenom: true } },
    },
  });

  if (!compte) return NextResponse.json({ error: "Compte courant introuvable" }, { status: 404 });

  return NextResponse.json({ data: compte });
}

/**
 * PATCH /api/comptes-courants/[id]
 * Correction des informations du compte par l'admin : libellé, code agence,
 * code guichet (RIB régénéré), type de compte. Solde/totaux restent dérivés.
 * Réservé ADMIN / SUPER_ADMIN. Journalisé.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getAuthSession();
  const role = session?.user?.role;
  if (!session || (role !== "ADMIN" && role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });
  }

  const { id } = await params;
  const compteId = Number(id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Corps invalide" }, { status: 400 });

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: { id: true, numeroCompte: true, cleRib: true, codeAgence: true, codeGuichet: true },
  });
  if (!compte) return NextResponse.json({ error: "Compte courant introuvable" }, { status: 404 });

  const data: Prisma.CompteCourantUncheckedUpdateInput = {};
  if ("libelle" in body) data.libelle = typeof body.libelle === "string" && body.libelle.trim() ? body.libelle.trim() : null;

  const codeAgence = typeof body.codeAgence === "string" && body.codeAgence.trim() ? body.codeAgence.trim() : compte.codeAgence;
  const codeGuichet = typeof body.codeGuichet === "string" && body.codeGuichet.trim() ? body.codeGuichet.trim() : compte.codeGuichet;
  const codesChanges = codeAgence !== compte.codeAgence || codeGuichet !== compte.codeGuichet;
  if (codeAgence !== compte.codeAgence) data.codeAgence = codeAgence;
  if (codeGuichet !== compte.codeGuichet) data.codeGuichet = codeGuichet;
  if (codesChanges) data.ribComplet = formatRibComplet(codeAgence, codeGuichet, compte.numeroCompte, compte.cleRib);

  if ("typeCompte" in body && body.typeCompte) {
    if (!TYPES_COMPTE.has(body.typeCompte)) return NextResponse.json({ error: "Type de compte invalide" }, { status: 400 });
    data.typeCompte = body.typeCompte as Prisma.CompteCourantUncheckedUpdateInput["typeCompte"];
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Aucune modification" }, { status: 400 });

  const { ip, userAgent } = extraireMetaRequete(req);
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.compteCourant.update({ where: { id: compteId }, data });
    await auditLog(tx, Number(session.user.id), "CC_COMPTE_MODIFIE", "CompteCourant", compteId,
      { champs: Object.keys(data) }, { ip, userAgent });
    return u;
  });

  return NextResponse.json({ data: updated });
}
