import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/clients/[id]/historique?page=1&limit=30
 * Timeline unifiée : collectes · versements · ventes · audit logs
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ message: 'ID invalide' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get('page')  ?? '1'));
    const limit = Math.min(50, Number(searchParams.get('limit') ?? '30'));

    // ── Vue "detail" : payload structuré pour le drawer historique de la liste clients ──
    if (searchParams.get('view') === 'detail') {
      return await getDetailHistorique(clientId);
    }

    const [lignesCollecte, versements, ventes, credits, remboursementsCredit, auditLogs] = await Promise.all([

      prisma.ligneCollecte.findMany({
        where: { clientId, type: "PACK" },
        select: {
          id:              true,
          montantCollecte: true,
          statut:          true,
          createdAt:       true,
          collecte: {
            select: {
              reference:    true,
              dateCollecte: true,
              statut:       true,
              agent: { select: { nom: true, prenom: true } },
            },
          },
          souscription: { select: { pack: { select: { nom: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      prisma.versementPack.findMany({
        where: { souscription: { clientId } },
        select: {
          id:             true,
          montant:        true,
          type:           true,
          statut:         true,
          datePaiement:   true,
          reference:      true,
          encaisseParNom: true,
          createdAt:      true,
          souscription: { select: { pack: { select: { nom: true } } } },
        },
        orderBy: { datePaiement: 'desc' },
      }),

      prisma.venteDirecte.findMany({
        where: { clientId },
        select: {
          id:           true,
          reference:    true,
          statut:       true,
          modePaiement: true,
          montantTotal: true,
          createdAt:    true,
          pointDeVente: { select: { nom: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      prisma.creditClient.findMany({
        where: { clientId },
        select: {
          id:           true,
          reference:    true,
          statut:       true,
          montantTotal: true,
          createdAt:    true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      prisma.remboursementCredit.findMany({
        where: { credit: { clientId } },
        select: {
          id:                true,
          montant:           true,
          dateRemboursement: true,
          modePaiement:      true,
          statut:            true,
          credit:            { select: { reference: true } },
        },
        orderBy: { dateRemboursement: 'desc' },
      }),

      prisma.auditLog.findMany({
        where: { entite: 'Client', entiteId: clientId },
        select: {
          id:        true,
          action:    true,
          createdAt: true,
          user:      { select: { nom: true, prenom: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    type TItem = {
      id: string;
      type: 'COLLECTE' | 'VERSEMENT' | 'VENTE' | 'CREDIT' | 'AUDIT';
      date: string;
      titre: string;
      detail: string;
      montant?: number;
      statut?: string;
      reference?: string;
    };

    const items: TItem[] = [
      ...lignesCollecte.map((l) => ({
        id:      `col-${l.id}`,
        type:    'COLLECTE' as const,
        date:    l.collecte.dateCollecte.toISOString(),
        titre:   `Collecte – ${l.souscription!.pack.nom}`,
        detail:  `Agent : ${l.collecte.agent.prenom} ${l.collecte.agent.nom} · Réf : ${l.collecte.reference}`,
        montant: Number(l.montantCollecte),
        statut:  l.statut,
      })),
      ...versements.map((v) => ({
        id:        `ver-${v.id}`,
        type:      'VERSEMENT' as const,
        date:      v.datePaiement.toISOString(),
        titre:     `Versement – ${v.souscription.pack.nom}`,
        detail:    v.encaisseParNom ? `Encaissé par ${v.encaisseParNom}` : v.type.replace(/_/g, ' '),
        montant:   Number(v.montant),
        statut:    v.statut,
        reference: v.reference ?? undefined,
      })),
      ...ventes.map((v) => ({
        id:        `ven-${v.id}`,
        type:      'VENTE' as const,
        date:      v.createdAt.toISOString(),
        titre:     `Vente – ${v.pointDeVente.nom}`,
        detail:    `${v.modePaiement.replace(/_/g, ' ')} · ${v.reference}`,
        montant:   Number(v.montantTotal),
        statut:    v.statut,
        reference: v.reference,
      })),
      ...credits.map((c) => ({
        id:        `crd-${c.id}`,
        type:      'CREDIT' as const,
        date:      c.createdAt.toISOString(),
        titre:     `Crédit octroyé – ${c.reference}`,
        detail:    `Montant total : ${Number(c.montantTotal).toLocaleString('fr-FR')} FCFA`,
        montant:   Number(c.montantTotal),
        statut:    c.statut,
        reference: c.reference,
      })),
      ...remboursementsCredit.map((r) => ({
        id:        `rem-${r.id}`,
        type:      'CREDIT' as const,
        date:      r.dateRemboursement.toISOString(),
        titre:     `Remboursement crédit – ${r.credit.reference}`,
        detail:    r.modePaiement.replace(/_/g, ' '),
        montant:   Number(r.montant),
        statut:    r.statut,
        reference: r.credit.reference,
      })),
      ...auditLogs.map((a) => ({
        id:     `aud-${a.id}`,
        type:   'AUDIT' as const,
        date:   a.createdAt.toISOString(),
        titre:  auditLabel(a.action),
        detail: a.user ? `Par ${a.user.prenom} ${a.user.nom}` : 'Système',
      })),
    ];

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total      = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paged      = items.slice((page - 1) * limit, page * limit);

    return NextResponse.json({ data: paged, meta: { total, page, limit, totalPages } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur historique client' }, { status: 500 });
  }
}

/**
 * Payload structuré attendu par le drawer "Historique" de /dashboard/admin/clients :
 * cartes de totaux + souscriptions (avec versements) + ventes directes (avec lignes).
 */
async function getDetailHistorique(clientId: number) {
  const [client, souscriptionsRaw, ventesRaw, creditsRaw] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true, nom: true, prenom: true, telephone: true,
        pointsDeVente: { select: { pointDeVente: { select: { id: true, nom: true, code: true } } } },
      },
    }),

    prisma.souscriptionPack.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, statut: true,
        montantTotal: true, montantVerse: true, montantRestant: true,
        dateDebut: true, dateFin: true, dateCloture: true, createdAt: true,
        pack: { select: { id: true, nom: true, type: true } },
        versements: {
          orderBy: { datePaiement: 'desc' },
          select: { id: true, montant: true, type: true, datePaiement: true, encaisseParNom: true, notes: true },
        },
      },
    }),

    prisma.venteDirecte.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, reference: true, montantTotal: true, montantPaye: true,
        modePaiement: true, statut: true, notes: true, createdAt: true,
        pointDeVente: { select: { nom: true, code: true } },
        lignes: {
          select: {
            quantite: true, prixUnitaire: true, montant: true, produitNom: true,
            produit: { select: { nom: true } },
          },
        },
      },
    }),

    prisma.creditClient.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, reference: true, statut: true,
        montantTotal: true, montantRembourse: true, soldeRestant: true,
        dureeJours: true, montantJournalier: true,
        dateDebut: true, dateEcheanceFin: true, createdAt: true,
        remboursements: {
          orderBy: { dateRemboursement: 'desc' },
          select: { id: true, montant: true, dateRemboursement: true, modePaiement: true, statut: true, numeroJour: true },
        },
      },
    }),
  ]);

  if (!client) return NextResponse.json({ message: 'Client introuvable' }, { status: 404 });

  // Normalisation des lignes de vente (produit catalogue ou nom libre)
  const ventesDirectes = ventesRaw.map((v) => ({
    ...v,
    lignes: v.lignes.map((l) => ({
      quantite:     l.quantite,
      prixUnitaire: l.prixUnitaire,
      montant:      l.montant,
      produit:      { nom: l.produit?.nom ?? l.produitNom ?? '—' },
    })),
  }));

  // Totaux
  const totalVersementsPacks = souscriptionsRaw.reduce((s, x) => s + Number(x.montantVerse), 0);
  const totalAchatsDirects   = ventesRaw.reduce((s, x) => s + Number(x.montantPaye), 0);
  const totalDu = souscriptionsRaw
    .filter((x) => x.statut !== 'ANNULE' && x.statut !== 'COMPLETE')
    .reduce((s, x) => s + Number(x.montantRestant), 0);

  // Totaux crédits
  const ACTIFS = ['ACTIF', 'EN_RETARD'];
  const totalCreditRembourse = creditsRaw.reduce((s, x) => s + Number(x.montantRembourse), 0);
  const soldeCredit = creditsRaw
    .filter((x) => ACTIFS.includes(x.statut))
    .reduce((s, x) => s + Number(x.soldeRestant), 0);
  const nbCreditsActifs = creditsRaw.filter((x) => ACTIFS.includes(x.statut)).length;

  return NextResponse.json({
    success: true,
    client,
    souscriptions: souscriptionsRaw,
    ventesDirectes,
    credits: creditsRaw,
    totaux: {
      totalVersementsPacks,
      totalAchatsDirects,
      totalPaye: totalVersementsPacks + totalAchatsDirects,
      totalDu,
      nbSouscriptions: souscriptionsRaw.length,
      nbAchats: ventesRaw.length,
      totalCreditRembourse,
      soldeCredit,
      nbCredits: creditsRaw.length,
      nbCreditsActifs,
    },
  });
}

function auditLabel(action: string) {
  const map: Record<string, string> = {
    CREATION_CLIENT:           'Création du client',
    MODIFICATION_CLIENT:       'Modification du profil',
    SUPPRESSION_CLIENT:        'Suppression du client',
    CREATION_SOUSCRIPTION:     'Souscription créée',
    MODIFICATION_SOUSCRIPTION: 'Souscription modifiée',
    VALIDATION_COLLECTE:       'Collecte validée',
    ANNULATION_COLLECTE:       'Collecte annulée',
    CREATION_VERSEMENT:        'Versement enregistré',
  };
  return map[action] ?? action.replace(/_/g, ' ');
}
