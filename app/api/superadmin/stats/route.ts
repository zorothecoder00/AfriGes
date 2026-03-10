import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since1h  = new Date(Date.now() -      60 * 60 * 1000);

    const [
      totalUsers, usersActifs, usersSuspendus, usersInactifs,
      totalClients, totalPDV,
      ventes24h, ventesCA,
      produitsRupture, produitsTous,
      logsRecents,
      notificationsNonLues,
      souscriptionsActives,
      loginFailed1h,
      securityLogs24h,
      caissesOuvertes,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { etat: "ACTIF" } }),
      prisma.user.count({ where: { etat: "SUSPENDU" } }),
      prisma.user.count({ where: { etat: "INACTIF" } }),
      prisma.client.count(),
      prisma.pointDeVente.count({ where: { actif: true } }),
      prisma.venteDirecte.count({ where: { createdAt: { gte: since24h } } }),
      prisma.venteDirecte.aggregate({ _sum: { montantTotal: true }, where: { statut: "CONFIRMEE" } }),
      prisma.produit.count({ where: { stocks: { none: { quantite: { gt: 0 } } } } }),
      prisma.produit.findMany({ select: { alerteStock: true, stocks: { select: { quantite: true } } } }),
      prisma.auditLog.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { nom: true, prenom: true, email: true, role: true } } },
      }),
      prisma.notification.count({ where: { lue: false } }),
      prisma.souscriptionPack.count({ where: { statut: { in: ["ACTIF", "COMPLETE"] } } }),
      prisma.securityLog.count({ where: { action: "LOGIN_FAILED", createdAt: { gte: since1h } } }).catch(() => 0),
      prisma.securityLog.count({ where: { createdAt: { gte: since24h } } }).catch(() => 0),
      prisma.caissePDV.count({ where: { statut: "OUVERTE" } }).catch(() => 0),
    ]);

    const stockFaible = produitsTous.filter((p) => {
      const total = p.stocks.reduce((s, ss) => s + ss.quantite, 0);
      return total > 0 && p.alerteStock > 0 && total <= p.alerteStock;
    }).length;

    const alertes: { type: string; message: string; priorite: string }[] = [];
    if (produitsRupture > 0)
      alertes.push({ type: "RUPTURE_STOCK", message: `${produitsRupture} produit(s) en rupture de stock`, priorite: "CRITIQUE" });
    if (stockFaible > 0)
      alertes.push({ type: "STOCK_FAIBLE", message: `${stockFaible} produit(s) en stock faible`, priorite: "HAUTE" });
    if (usersSuspendus > 0)
      alertes.push({ type: "COMPTES_SUSPENDUS", message: `${usersSuspendus} compte(s) suspendu(s)`, priorite: "HAUTE" });
    if (loginFailed1h >= 5)
      alertes.push({ type: "SECURITE", message: `${loginFailed1h} tentatives de connexion échouées cette heure`, priorite: "CRITIQUE" });

    return NextResponse.json({
      utilisateurs: { total: totalUsers, actifs: usersActifs, suspendus: usersSuspendus, inactifs: usersInactifs },
      operations:   { clients: totalClients, pdvActifs: totalPDV, souscriptionsActives, ventes24h, ventesCA: Number(ventesCA._sum.montantTotal ?? 0) },
      stock:        { rupture: produitsRupture, faible: stockFaible },
      systeme:      { caissesOuvertes, notificationsNonLues, securityLogs24h },
      alertes,
      logsRecents: logsRecents.map((l) => ({
        id: l.id, action: l.action, entite: l.entite, entiteId: l.entiteId,
        date: l.createdAt.toISOString(),
        user: l.user ? `${l.user.prenom} ${l.user.nom}` : "Système",
        role: l.user?.role ?? null,
      })),
    });
  } catch (error) {
    console.error("GET /api/superadmin/stats", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
