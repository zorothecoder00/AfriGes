import { NextResponse } from "next/server";
import { Prisma, StatutCompteCourant, TypeCompteCC, RoleMembreCC } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import {
  chargerParametrageCC, genererNumeroCompte, calculerCleRib, formatRibComplet, enregistrerDepotCC,
  extraireMetaRequete,
} from "@/lib/compteCourant";
import { notifyAdmins, auditLog } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

/**
 * /api/comptes-courants
 * GET  — liste paginée + recherche (CDC §12) — capacité READ
 * POST — ouverture d'un compte pour un client existant — capacité CREATE
 */

const clientSelect = {
  id: true, nom: true, prenom: true, telephone: true, codeClient: true,
  quartier: true, ville: true, commune: true, photoUrl: true, etat: true,
  agentTerrain: { select: { id: true, nom: true, prenom: true } },
  pointDeVente: { select: { id: true, nom: true, code: true } },
} satisfies Prisma.ClientSelect;

export async function GET(req: Request) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, Number(searchParams.get("page") || 1));
  const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
  const skip   = (page - 1) * limit;
  const search = (searchParams.get("search") || "").trim();
  const statut = searchParams.get("statut") as StatutCompteCourant | null;
  const typeCompte = searchParams.get("type") as TypeCompteCC | null;

  const insensitive = { mode: "insensitive" as const };
  const where: Prisma.CompteCourantWhereInput = {
    ...(statut && { statut }),
    ...(typeCompte && { typeCompte }),
    ...(search && {
      OR: [
        { numeroCompte: { contains: search } },
        { ribComplet:   { contains: search, ...insensitive } },
        { libelle:      { contains: search, ...insensitive } },
        { client: { nom:        { contains: search, ...insensitive } } },
        { client: { prenom:     { contains: search, ...insensitive } } },
        { client: { telephone:  { contains: search } } },
        { client: { codeClient: { contains: search, ...insensitive } } },
        { client: { quartier:   { contains: search, ...insensitive } } },
        { client: { ville:      { contains: search, ...insensitive } } },
        { client: { commune:    { contains: search, ...insensitive } } },
        { client: { agentTerrain: { OR: [
          { nom:    { contains: search, ...insensitive } },
          { prenom: { contains: search, ...insensitive } },
        ] } } },
      ],
    }),
  };

  const [comptes, total] = await Promise.all([
    prisma.compteCourant.findMany({
      where, skip, take: limit, orderBy: { createdAt: "desc" },
      select: {
        id: true, numeroCompte: true, ribComplet: true, statut: true,
        typeCompte: true, libelle: true,
        solde: true, totalDepose: true, totalRetire: true, totalUtilise: true,
        nbMouvements: true, dateOuverture: true, derniereOperationAt: true,
        client: { select: clientSelect },
        agentCreateur: { select: { id: true, nom: true, prenom: true } },
        _count: { select: { membres: true } },
      },
    }),
    prisma.compteCourant.count({ where }),
  ]);

  return NextResponse.json({ data: comptes, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
}

export async function POST(req: Request) {
  const session = await getCompteCourantSession("CREATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const clientId = Number(body?.clientId);
  if (!clientId) return NextResponse.json({ error: "Client requis" }, { status: 400 });

  // Dépôt d'ouverture optionnel (CDC §2) : s'il est fourni, il doit respecter le
  // montant minimum d'ouverture et les plafonds de dépôt du paramétrage.
  const depotInitial = body?.depotInitial != null && body.depotInitial !== "" ? Number(body.depotInitial) : 0;
  if (isNaN(depotInitial) || depotInitial < 0) {
    return NextResponse.json({ error: "Dépôt d'ouverture invalide" }, { status: 400 });
  }
  const modePaiement = typeof body?.modePaiement === "string" && body.modePaiement.trim() ? body.modePaiement.trim() : null;

  // Type de compte (CDC §19.A) : individuel ou collectif (ménage/communauté/groupement).
  const TYPES_CC = ["INDIVIDUEL", "MENAGE", "COMMUNAUTE", "GROUPEMENT"] as const;
  const typeCompte = TYPES_CC.includes(body?.typeCompte) ? (body.typeCompte as TypeCompteCC) : "INDIVIDUEL";
  const estCollectif = typeCompte !== "INDIVIDUEL";
  const libelle = typeof body?.libelle === "string" && body.libelle.trim() ? body.libelle.trim() : null;
  if (estCollectif && !libelle) {
    return NextResponse.json({ error: "Un libellé (nom du ménage / communauté / groupement) est requis pour un compte collectif" }, { status: 400 });
  }

  // Membres additionnels (comptes collectifs) : le titulaire principal est ajouté d'office.
  // Seul le principal peut être TITULAIRE → les membres additionnels sont MANDATAIRE ou MEMBRE.
  const ROLES_ADDITIONNELS = ["MANDATAIRE", "MEMBRE"] as const;
  const membresBruts: Array<{ clientId: number; role: RoleMembreCC; quotePart: number | null }> = Array.isArray(body?.membres)
    ? body.membres
        .map((m: unknown) => {
          const o = m as { clientId?: unknown; role?: unknown; quotePart?: unknown };
          const mcid = Number(o?.clientId);
          if (!mcid || mcid === clientId) return null; // le principal est géré séparément
          const role = ROLES_ADDITIONNELS.includes(o?.role as "MANDATAIRE" | "MEMBRE") ? (o.role as RoleMembreCC) : "MEMBRE";
          const qp = o?.quotePart != null && o.quotePart !== "" ? Number(o.quotePart) : null;
          return { clientId: mcid, role, quotePart: qp != null && !isNaN(qp) ? qp : null };
        })
        .filter((m: unknown): m is { clientId: number; role: RoleMembreCC; quotePart: number | null } => m !== null)
    : [];
  // Dédoublonnage par clientId (garde la première occurrence).
  const membres = [...new Map(membresBruts.map((m) => [m.clientId, m])).values()];

  const client = await prisma.client.findUnique({
    where: { id: clientId }, select: { id: true, nom: true, prenom: true },
  });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  // Vérifie l'existence des clients membres (comptes collectifs).
  if (membres.length > 0) {
    const ids = membres.map((m) => m.clientId);
    const trouves = await prisma.client.count({ where: { id: { in: ids } } });
    if (trouves !== ids.length) {
      return NextResponse.json({ error: "Un ou plusieurs membres sont introuvables" }, { status: 404 });
    }
  }

  // Unicité : un seul compte INDIVIDUEL par client. Les comptes collectifs ne sont
  // pas limités (un client peut représenter plusieurs groupements) — CDC §19.A.
  if (!estCollectif) {
    const deja = await prisma.compteCourant.findFirst({
      where: { clientId, typeCompte: "INDIVIDUEL" }, select: { id: true },
    });
    if (deja) return NextResponse.json({ error: "Ce client possède déjà un compte courant individuel" }, { status: 409 });
  }

  const param = await chargerParametrageCC();

  if (depotInitial > 0) {
    const minOuverture = Number(param.montantMinOuverture);
    if (depotInitial < minOuverture) {
      return NextResponse.json({ error: `Dépôt d'ouverture minimum : ${minOuverture.toLocaleString("fr-FR")} FCFA` }, { status: 422 });
    }
    if (param.depotMax != null && depotInitial > Number(param.depotMax)) {
      return NextResponse.json({ error: `Dépôt maximum : ${Number(param.depotMax).toLocaleString("fr-FR")} FCFA` }, { status: 422 });
    }
    if (param.soldeMaxAutorise != null && depotInitial > Number(param.soldeMaxAutorise)) {
      return NextResponse.json({ error: `Solde maximum autorisé dépassé (${Number(param.soldeMaxAutorise).toLocaleString("fr-FR")} FCFA)` }, { status: 422 });
    }
  }

  const clientNom = `${client.prenom} ${client.nom}`;
  const userId = Number(session.user.id);
  const { ip, userAgent } = extraireMetaRequete(req);

  // Génération du numéro (12 chiffres) avec retry en cas de collision concurrente.
  for (let attempt = 0; attempt < 6; attempt++) {
    const count        = await prisma.compteCourant.count();
    const numeroCompte = genererNumeroCompte(count + 1 + attempt);
    const cleRib       = calculerCleRib(numeroCompte);
    const ribComplet   = formatRibComplet(param.codeAgence, param.codeGuichet, numeroCompte, cleRib);

    try {
      const compte = await prisma.$transaction(async (tx) => {
        const created = await tx.compteCourant.create({
          data: {
            numeroCompte, cleRib, ribComplet,
            codeAgence: param.codeAgence, codeGuichet: param.codeGuichet,
            clientId, typeCompte, libelle,
            agentCreateurId: userId,
          },
          select: {
            id: true, numeroCompte: true, ribComplet: true, cleRib: true,
            codeAgence: true, codeGuichet: true, statut: true, solde: true,
            typeCompte: true, libelle: true, dateOuverture: true,
            client: { select: clientSelect },
            agentCreateur: { select: { id: true, nom: true, prenom: true } },
          },
        });

        // Titulaire principal + membres additionnels (CDC §19.A). Le principal
        // est toujours enregistré comme TITULAIRE ; les doublons éventuels du
        // principal ont déjà été écartés côté parsing.
        await tx.membreCompteCourant.create({
          data: { compteId: created.id, clientId, role: "TITULAIRE", ajouteParId: userId },
        });
        if (membres.length > 0) {
          await tx.membreCompteCourant.createMany({
            data: membres.map((m) => ({
              compteId: created.id, clientId: m.clientId, role: m.role,
              quotePart: m.quotePart, ajouteParId: userId,
            })),
            skipDuplicates: true,
          });
        }

        await auditLog(tx, userId, "CREATION_COMPTE_COURANT", "CompteCourant", created.id, undefined, { ip, userAgent });

        // Dépôt d'ouverture éventuel (mouvement DEPOT + écriture comptable).
        if (depotInitial > 0) {
          const depot = await enregistrerDepotCC(tx, {
            compteId: created.id, numeroCompte: created.numeroCompte, codeAgence: created.codeAgence,
            clientNom, montant: depotInitial, userId, param,
            modePaiement, observation: "Dépôt d'ouverture", ip, userAgent, ouverture: true,
          });
          await notifyAdmins(tx, {
            titre: "Ouverture compte courant",
            message: `Compte ${created.numeroCompte} ouvert pour ${clientNom} avec un dépôt d'ouverture de ${depotInitial.toLocaleString("fr-FR")} FCFA.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/comptes-courants/${created.id}`,
          });
          return { ...created, solde: depot.soldeApres };
        }
        return created;
      });

      return NextResponse.json({ data: compte }, { status: 201 });
    } catch (e) {
      // Collision sur le numéro de compte (seule contrainte unique en jeu ici,
      // clientId n'étant plus unique) → on retente avec le compteur réévalué.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        continue;
      }
      console.error("POST /api/comptes-courants", e);
      return NextResponse.json({ error: "Erreur lors de l'ouverture du compte" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Impossible de générer un numéro unique, réessayez" }, { status: 500 });
}
