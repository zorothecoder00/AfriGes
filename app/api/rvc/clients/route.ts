import { NextResponse } from "next/server";
import { MemberStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

/**
 * GET /api/rvc/clients
 * ?etat=EN_ATTENTE_VALIDATION|ACTIF|REJETE  (défaut : EN_ATTENTE_VALIDATION)
 * ?search=&page=1&limit=20
 *
 * Filtre automatiquement sur le PDV du RVC connecté.
 * Les admins voient tous les PDV (pas de restriction).
 */
export async function GET(req: Request) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    // ── Résolution du PDV du RVC ──────────────────────────────────────────────
    let pdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: parseInt(session.user.id), actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) {
        return NextResponse.json({ error: "Aucun point de vente associé à ce responsable crédit" }, { status: 400 });
      }
      pdvId = aff.pointDeVenteId;
    }

    const { searchParams } = new URL(req.url);
    const rawEtat = searchParams.get("etat") || "EN_ATTENTE_VALIDATION";
    const etat    = rawEtat as MemberStatus;
    const search  = (searchParams.get("search") || "").trim();
    const page    = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit   = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip    = (page - 1) * limit;

    // ── Filtre principal ──────────────────────────────────────────────────────
    const where: Prisma.ClientWhereInput = {
      etat,
      // Restriction PDV pour les non-admins
      ...(pdvId !== null && { pointDeVenteId: pdvId }),
    };

    if (search) {
      const parts = search.split(/\s+/);
      const conds: Prisma.ClientWhereInput[] = [
        { nom:        { contains: search, mode: "insensitive" } },
        { prenom:     { contains: search, mode: "insensitive" } },
        { telephone:  { contains: search, mode: "insensitive" } },
        { codeClient: { contains: search, mode: "insensitive" } },
      ];
      if (parts.length >= 2) {
        const [first, ...rest] = parts;
        const restStr = rest.join(" ");
        conds.push({ AND: [{ prenom: { contains: first, mode: "insensitive" } }, { nom: { contains: restStr, mode: "insensitive" } }] });
        conds.push({ AND: [{ nom:    { contains: first, mode: "insensitive" } }, { prenom: { contains: restStr, mode: "insensitive" } }] });
      }
      where.OR = conds;
    }

    const select = {
      id: true,
      codeClient: true,
      nom: true,
      prenom: true,
      telephone: true,
      telephoneSecondaire: true,
      adresse: true,
      quartier: true,
      ville: true,
      activite: true,
      nomCommerce: true,
      sexe: true,
      numeroCNI: true,
      etat: true,
      typeClient: true,
      niveauRisque: true,
      limiteCredit: true,
      motifRejet: true,
      dateValidation: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      agentTerrain: {
        select: { nom: true, prenom: true, telephone: true },
      },
      pointDeVente: {
        select: { nom: true, code: true },
      },
      validationPar: {
        select: { nom: true, prenom: true },
      },
      _count: {
        select: {
          creditsClients: true,
          souscriptionsPacks: true,
        },
      },
    } satisfies Prisma.ClientSelect;

    const [clients, total] = await Promise.all([
      prisma.client.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, select }),
      prisma.client.count({ where }),
    ]);

    return NextResponse.json({
      data: clients,
      pdvId,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/rvc/clients error:", error);
    return NextResponse.json({ error: "Erreur chargement clients" }, { status: 500 });
  }
}
