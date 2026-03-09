import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";

/**
 * GET /api/rpv/equipe
 *
 * Retourne les gestionnaires actuellement affectés au PDV du RPV connecté
 * (via GestionnaireAffectation.actif = true), avec leurs performances 30j.
 *
 * Le RPV ne peut que CONSULTER — la gestion des affectations est réservée à l'admin.
 *
 * Query: search
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);

    // PDV du RPV
    const pdv = await prisma.pointDeVente.findUnique({ where: { rpvId: userId } });
    if (!pdv) return NextResponse.json({ message: "Aucun PDV associé" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";

    // Membres affectés à ce PDV (actifs uniquement)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      pointDeVenteId: pdv.id,
      actif: true,
    };

    if (search) {
      where.user = {
        OR: [
          { nom:    { contains: search, mode: "insensitive" } },
          { prenom: { contains: search, mode: "insensitive" } },
          { email:  { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const affectations = await prisma.gestionnaireAffectation.findMany({
      where,
      include: {
        user: {
          select: {
            id: true, nom: true, prenom: true, email: true,
            telephone: true, etat: true, photo: true, dateAdhesion: true,
            gestionnaire: { select: { id: true, role: true, actif: true } },
          },
        },
      },
      orderBy: { dateDebut: "desc" },
    });

    // ── Performances 30 derniers jours ────────────────────────────────────────
    const depuis30j = new Date();
    depuis30j.setDate(depuis30j.getDate() - 30);
    depuis30j.setHours(0, 0, 0, 0);

    const rolesVendeurs = ["CAISSIER", "AGENT_TERRAIN", "COMMERCIAL", "RESPONSABLE_VENTE_CREDIT"];

    const vendeurIds = affectations
      .filter(a => a.user.gestionnaire && rolesVendeurs.includes(a.user.gestionnaire.role))
      .map(a => a.user.id);

    const [ventesConfirmees, ventesAnnulees, clientsDistincts] = await Promise.all([
      vendeurIds.length > 0
        ? prisma.venteDirecte.groupBy({
            by: ["vendeurId"],
            where: {
              pointDeVenteId: pdv.id,
              vendeurId: { in: vendeurIds },
              statut: "CONFIRMEE",
              createdAt: { gte: depuis30j },
            },
            _sum:   { montantTotal: true },
            _count: { id: true },
            _avg:   { montantTotal: true },
          })
        : [],

      vendeurIds.length > 0
        ? prisma.venteDirecte.groupBy({
            by: ["vendeurId"],
            where: {
              pointDeVenteId: pdv.id,
              vendeurId: { in: vendeurIds },
              statut: "ANNULEE",
              createdAt: { gte: depuis30j },
            },
            _count: { id: true },
          })
        : [],

      vendeurIds.length > 0
        ? prisma.venteDirecte.findMany({
            where: {
              pointDeVenteId: pdv.id,
              vendeurId: { in: vendeurIds },
              statut: "CONFIRMEE",
              clientId: { not: null },
              createdAt: { gte: depuis30j },
            },
            select: { vendeurId: true, clientId: true },
            distinct: ["vendeurId", "clientId"],
          })
        : [],
    ]);

    // Map performances par userId
    const perfMap: Record<number, {
      nbVentes: number; montantTotal: number; panierMoyen: number;
      nbAnnulees: number; nbClientsDistincts: number;
    }> = {};

    for (const v of ventesConfirmees) {
      if (!v.vendeurId) continue;
      perfMap[v.vendeurId] = {
        nbVentes:          v._count.id,
        montantTotal:      Number(v._sum.montantTotal ?? 0),
        panierMoyen:       Number(v._avg.montantTotal ?? 0),
        nbAnnulees:        0,
        nbClientsDistincts:0,
      };
    }
    for (const v of ventesAnnulees) {
      if (!v.vendeurId) continue;
      if (!perfMap[v.vendeurId]) perfMap[v.vendeurId] = { nbVentes: 0, montantTotal: 0, panierMoyen: 0, nbAnnulees: 0, nbClientsDistincts: 0 };
      perfMap[v.vendeurId].nbAnnulees = v._count.id;
    }
    for (const v of clientsDistincts) {
      if (!v.vendeurId) continue;
      if (!perfMap[v.vendeurId]) perfMap[v.vendeurId] = { nbVentes: 0, montantTotal: 0, panierMoyen: 0, nbAnnulees: 0, nbClientsDistincts: 0 };
      perfMap[v.vendeurId].nbClientsDistincts += 1;
    }

    // Stats par rôle
    const statsParRole: Record<string, { total: number; actifs: number }> = {};
    for (const a of affectations) {
      const g = a.user.gestionnaire;
      if (!g) continue;
      if (!statsParRole[g.role]) statsParRole[g.role] = { total: 0, actifs: 0 };
      statsParRole[g.role].total += 1;
      if (g.actif && a.user.etat === "ACTIF") statsParRole[g.role].actifs += 1;
    }

    const data = affectations.map(a => {
      const g = a.user.gestionnaire;
      const roleActif = g?.role ?? "INCONNU";
      const estActif  = (g?.actif ?? false) && a.user.etat === "ACTIF";

      return {
        id:           a.id,
        userId:       a.user.id,
        role:         roleActif,
        actif:        estActif,
        dateDebut:    a.dateDebut.toISOString(),
        member: {
          id:           a.user.id,
          nom:          a.user.nom,
          prenom:       a.user.prenom,
          email:        a.user.email,
          telephone:    a.user.telephone,
          etat:         a.user.etat,
          photo:        a.user.photo,
          dateAdhesion: a.user.dateAdhesion.toISOString(),
        },
        performance: perfMap[a.user.id] ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      stats: {
        total:   data.length,
        actifs:  data.filter(d => d.actif).length,
        parRole: statsParRole,
      },
    });
  } catch (error) {
    console.error("GET /api/rpv/equipe error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
