import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/agents-terrain/[id]/collectes
 * Historique détaillé des encaissements d'un agent (toutes sources) avec info client.
 * [id] = memberId de l'agent
 * Query: ?limit=50&mois=YYYY-MM (optionnel)
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const agentId = Number(id);
    if (isNaN(agentId)) return NextResponse.json({ message: 'ID invalide' }, { status: 400 });

    const { searchParams } = new URL(_req.url);
    const limitParam = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 100)));
    // Filtre mois optionnel (format YYYY-MM)
    const moisParam = searchParams.get('mois');
    let dateMin: Date | undefined;
    let dateMax: Date | undefined;
    if (moisParam && /^\d{4}-\d{2}$/.test(moisParam)) {
      const [y, m] = moisParam.split('-').map(Number);
      dateMin = new Date(y, m - 1, 1);
      dateMax = new Date(y, m, 1);
    }

    // ── 1. Collectes terrain (sessions validées + détail par client) ──────────
    const collectes = await prisma.collecteJournaliere.findMany({
      where: {
        agentId,
        statut: 'VALIDEE',
        ...(dateMin && dateMax ? { dateCollecte: { gte: dateMin, lt: dateMax } } : {}),
      },
      select: {
        id: true,
        reference: true,
        dateCollecte: true,
        montantCollecte: true,
        lignes: {
          where: { statut: { in: ['COLLECTE', 'PARTIEL'] } },
          select: {
            id: true,
            montantCollecte: true,
            statut: true,
            client: { select: { id: true, nom: true, prenom: true, telephone: true, codeClient: true } },
          },
        },
      },
      orderBy: { dateCollecte: 'desc' },
    });

    // Aplatir : une ligne par client collecté dans chaque session
    const lignesCollecte = collectes.flatMap((c) =>
      c.lignes.map((l) => ({
        id:          `col-${c.id}-${l.id}`,
        type:        'COLLECTE_TERRAIN' as const,
        typeLabel:   'Collecte terrain',
        date:        c.dateCollecte.toISOString(),
        reference:   c.reference,
        montant:     Number(l.montantCollecte),
        client:      l.client
          ? { id: l.client.id, nom: l.client.nom, prenom: l.client.prenom, telephone: l.client.telephone, codeClient: l.client.codeClient }
          : null,
      }))
    );

    // ── 2. Versements packs directs (encaisseParId = agent) ──────────────────
    const versements = await prisma.versementPack.findMany({
      where: {
        encaisseParId: agentId,
        statut: 'PAYE',
        // Exclure ceux issus d'une collecte (ils sont déjà dans lignesCollecte)
        ligneCollecte: { is: null },
        ...(dateMin && dateMax ? { datePaiement: { gte: dateMin, lt: dateMax } } : {}),
      },
      select: {
        id: true,
        reference: true,
        datePaiement: true,
        montant: true,
        souscription: {
          select: {
            client: { select: { id: true, nom: true, prenom: true, telephone: true, codeClient: true } },
          },
        },
      },
      orderBy: { datePaiement: 'desc' },
      take: limitParam,
    });

    const lignesVersements = versements.map((v) => ({
      id:        `vrs-${v.id}`,
      type:      'VERSEMENT_PACK' as const,
      typeLabel: 'Versement pack direct',
      date:      v.datePaiement.toISOString(),
      reference: v.reference ?? null,
      montant:   Number(v.montant),
      client:    v.souscription?.client ?? null,
    }));

    // ── 3. Remboursements crédits (enregistreParId = agent) ──────────────────
    const remboursements = await prisma.remboursementCredit.findMany({
      where: {
        enregistreParId: agentId,
        ...(dateMin && dateMax ? { dateRemboursement: { gte: dateMin, lt: dateMax } } : {}),
      },
      select: {
        id: true,
        dateRemboursement: true,
        montant: true,
        notes: true,
        credit: {
          select: {
            reference: true,
            client: { select: { id: true, nom: true, prenom: true, telephone: true, codeClient: true } },
          },
        },
      },
      orderBy: { dateRemboursement: 'desc' },
      take: limitParam,
    });

    const lignesRemboursements = remboursements.map((r) => ({
      id:        `rmb-${r.id}`,
      type:      'REMBOURSEMENT_CREDIT' as const,
      typeLabel: 'Remboursement crédit',
      date:      r.dateRemboursement.toISOString(),
      reference: r.credit?.reference ?? null,
      montant:   Number(r.montant),
      client:    r.credit?.client ?? null,
    }));

    // ── 4. Ventes directes (vendeurId = agent) ───────────────────────────────
    const ventes = await prisma.venteDirecte.findMany({
      where: {
        vendeurId: agentId,
        statut: { notIn: ['ANNULEE', 'BROUILLON'] },
        ...(dateMin && dateMax ? { createdAt: { gte: dateMin, lt: dateMax } } : {}),
      },
      select: {
        id: true,
        reference: true,
        createdAt: true,
        montantTotal: true,
        clientNom: true,
        clientTelephone: true,
        client: { select: { id: true, nom: true, prenom: true, telephone: true, codeClient: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limitParam,
    });

    const lignesVentes = ventes.map((v) => ({
      id:        `vnt-${v.id}`,
      type:      'VENTE_DIRECTE' as const,
      typeLabel: 'Vente directe',
      date:      v.createdAt.toISOString(),
      reference: v.reference,
      montant:   Number(v.montantTotal),
      // Client enregistré prioritaire, sinon walk-in
      client: v.client
        ? { id: v.client.id, nom: v.client.nom, prenom: v.client.prenom, telephone: v.client.telephone, codeClient: v.client.codeClient }
        : v.clientNom
          ? { id: null, nom: v.clientNom, prenom: '', telephone: v.clientTelephone ?? null, codeClient: null }
          : null,
    }));

    // ── Fusion & tri par date desc ────────────────────────────────────────────
    const all = [...lignesCollecte, ...lignesVersements, ...lignesRemboursements, ...lignesVentes]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limitParam);

    // ── Totaux par source ─────────────────────────────────────────────────────
    const totaux = {
      terrain:        lignesCollecte.reduce((s, l) => s + l.montant, 0),
      versements:     lignesVersements.reduce((s, l) => s + l.montant, 0),
      remboursements: lignesRemboursements.reduce((s, l) => s + l.montant, 0),
      ventes:         lignesVentes.reduce((s, l) => s + l.montant, 0),
      total:          0,
    };
    totaux.total = totaux.terrain + totaux.versements + totaux.remboursements + totaux.ventes;

    return NextResponse.json({ data: all, totaux, total: all.length });
  } catch (error) {
    console.error('GET /api/admin/agents-terrain/[id]/collectes', error);
    return NextResponse.json({ message: 'Erreur récupération historique collectes' }, { status: 500 });
  }
}
