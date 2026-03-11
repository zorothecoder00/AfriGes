import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditeurInterneSession } from "@/lib/authAuditeurInterne";

/**
 * GET /api/auditeur/logs-systeme?page=1&limit=25&type=security|audit&search=X&action=X&startDate=X&endDate=X
 *
 * Logs système : SecurityLog (connexions/déconnexions) + AuditLog sensibles
 *  (suppressions, corrections, changements de prix, modifications stock, gestion droits)
 * Lecture seule.
 */
export async function GET(req: Request) {
  try {
    const session = await getAuditeurInterneSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit     = Math.min(100, Math.max(5, Number(searchParams.get("limit") ?? "25")));
    const type      = searchParams.get("type") ?? "all"; // "security" | "audit" | "all"
    const search    = searchParams.get("search") ?? "";
    const action    = searchParams.get("action") ?? "";
    const startDate = searchParams.get("startDate") ?? "";
    const endDate   = searchParams.get("endDate") ?? "";

    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    // ── SecurityLog ────────────────────────────────────────────────────────────
    const securityWhere: Record<string, unknown> = {};
    if (Object.keys(dateFilter).length) securityWhere.createdAt = dateFilter;
    if (action)  securityWhere.action = { contains: action, mode: "insensitive" };
    if (search) {
      securityWhere.OR = [
        { action:    { contains: search, mode: "insensitive" } },
        { userEmail: { contains: search, mode: "insensitive" } },
        { details:   { contains: search, mode: "insensitive" } },
      ];
    }

    // ── AuditLog sensibles ─────────────────────────────────────────────────────
    // Mots-clés correspondant aux actions sensibles listées
    const SENSITIVE_KEYWORDS = [
      "supprim", "delete", "annul", "correct", "modif_prix", "prix",
      "ajustement", "stock", "permission", "droit", "role", "mot_de_passe",
      "password", "reset", "admin",
    ];

    const auditWhere: Record<string, unknown> = {
      OR: [
        ...SENSITIVE_KEYWORDS.map((kw) => ({ action: { contains: kw, mode: "insensitive" as const } })),
        ...(search ? [
          { action: { contains: search, mode: "insensitive" as const } },
          { entite: { contains: search, mode: "insensitive" as const } },
        ] : []),
      ],
    };
    if (Object.keys(dateFilter).length) auditWhere.createdAt = dateFilter;
    if (action) auditWhere.action = { contains: action, mode: "insensitive" };

    // Comptes pour les deux sources
    const [
      securityTotal,
      auditSensibleTotal,
      securityLogs,
      auditSensibleLogs,
      statsSecurityByAction,
      statsAuditByAction,
    ] = await Promise.all([
      type !== "audit"    ? prisma.securityLog.count({ where: securityWhere }) : Promise.resolve(0),
      type !== "security" ? prisma.auditLog.count({ where: auditWhere })       : Promise.resolve(0),

      type !== "audit" ? prisma.securityLog.findMany({
        where:   securityWhere,
        orderBy: { createdAt: "desc" },
        take:    type === "all" ? Math.ceil(limit / 2) : limit,
        skip:    type !== "all" ? (page - 1) * limit : 0,
        select: {
          id:        true,
          action:    true,
          ipAddress: true,
          userAgent: true,
          details:   true,
          createdAt: true,
          userEmail: true,
          user: { select: { id: true, nom: true, prenom: true, email: true } },
        },
      }) : Promise.resolve([]),

      type !== "security" ? prisma.auditLog.findMany({
        where:   auditWhere,
        orderBy: { createdAt: "desc" },
        take:    type === "all" ? Math.floor(limit / 2) : limit,
        skip:    type !== "all" ? (page - 1) * limit : 0,
        include: {
          user: { select: { id: true, nom: true, prenom: true, email: true } },
        },
      }) : Promise.resolve([]),

      prisma.securityLog.groupBy({
        by:       ["action"],
        _count:   { id: true },
        orderBy:  { _count: { id: "desc" } },
        take:     10,
      }),

      prisma.auditLog.groupBy({
        by:       ["action"],
        _count:   { id: true },
        where:    {
          OR: SENSITIVE_KEYWORDS.map((kw) => ({ action: { contains: kw, mode: "insensitive" as const } })),
        },
        orderBy:  { _count: { id: "desc" } },
        take:     10,
      }),
    ]);

    // ── Fusion et tri ──────────────────────────────────────────────────────────
    const entries = [
      ...securityLogs.map((l) => ({
        id:          l.id,
        source:      "SECURITY" as const,
        action:      l.action,
        entite:      "AuthSystem",
        entiteId:    null as number | null,
        details:     l.details ?? null,
        ipAddress:   l.ipAddress ?? null,
        userEmail:   l.userEmail ?? l.user?.email ?? null,
        utilisateur: l.user ? `${l.user.prenom} ${l.user.nom}` : (l.userEmail ?? "Inconnu"),
        createdAt:   l.createdAt.toISOString(),
        _time:       l.createdAt.getTime(),
      })),
      ...auditSensibleLogs.map((l) => ({
        id:          l.id,
        source:      "AUDIT" as const,
        action:      l.action,
        entite:      l.entite,
        entiteId:    l.entiteId ?? null,
        details:     null as null,
        ipAddress:   null as null,
        userEmail:   l.user?.email ?? null,
        utilisateur: l.user ? `${l.user.prenom} ${l.user.nom}` : "Système",
        createdAt:   l.createdAt.toISOString(),
        _time:       l.createdAt.getTime(),
      })),
    ]
      .sort((a, b) => b._time - a._time)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ _time, ...rest }) => rest);

    const totalAll = type === "security"
      ? securityTotal
      : type === "audit"
        ? auditSensibleTotal
        : securityTotal + auditSensibleTotal;

    return NextResponse.json({
      success: true,
      data:    entries,
      stats: {
        securityTotal,
        auditSensibleTotal,
        topActionsSecurite: statsSecurityByAction.map((s) => ({ action: s.action, count: s._count.id })),
        topActionsAudit:    statsAuditByAction.map((s)    => ({ action: s.action, count: s._count.id })),
      },
      meta: { total: totalAll, page, limit, totalPages: Math.ceil(totalAll / limit) },
    });
  } catch (error) {
    console.error("GET /api/auditeur/logs-systeme error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
