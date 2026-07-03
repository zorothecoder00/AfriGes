import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildCalendrier } from "@/lib/calendrierRemboursement";

export const dynamic = "force-dynamic"; // toujours à jour (pas de cache)

type Ctx = { params: Promise<{ reference: string }> };

const num = (v: unknown) => Number(v ?? 0);
const fmt = (v: unknown) => new Intl.NumberFormat("fr-FR").format(Math.round(num(v))) + " FCFA";
const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const SEXE_LABEL: Record<string, string> = { MASCULIN: "Masculin", FEMININ: "Féminin", AUTRE: "Autre" };

const STATUT_CREDIT_LABEL: Record<string, string> = {
  EN_ATTENTE_VALIDATION: "En attente de validation",
  ACTIF: "En cours de remboursement",
  EN_RETARD: "En retard",
  SOLDE: "Soldé",
  REJETE: "Rejeté",
  ANNULE: "Annulé",
};

export async function generateMetadata({ params }: Ctx) {
  const { reference } = await params;
  return { title: `Suivi du crédit ${reference} — AFRISIME` };
}

export default async function SuiviRemboursementPage({ params }: Ctx) {
  const { reference } = await params;

  const credit = await prisma.creditClient.findUnique({
    where:  { reference },
    select: {
      reference: true, statut: true, createdAt: true, dateDebut: true, dateEcheanceFin: true,
      montantTotal: true, montantRembourse: true, soldeRestant: true,
      dureeJours: true, montantJournalier: true,
      client: {
        select: {
          codeClient: true, nom: true, prenom: true, sexe: true,
          agentTerrain: { select: { nom: true, prenom: true } },
          pointDeVente: { select: { nom: true } },
        },
      },
      echeances: {
        orderBy: { numeroEcheance: "asc" },
        select: { numeroEcheance: true, dateEcheance: true, montantDu: true, montantPaye: true, statut: true },
      },
    },
  });

  if (!credit) notFound();

  const montantTotal     = num(credit.montantTotal);
  const montantRembourse = num(credit.montantRembourse);
  const soldeRestant     = num(credit.soldeRestant);
  const pct = montantTotal > 0 ? Math.min(100, Math.round((montantRembourse / montantTotal) * 100)) : 0;

  const rows = buildCalendrier({
    dureeJours:        credit.dureeJours,
    dateDebut:         credit.dateDebut.toISOString(),
    montantTotal:      montantTotal,
    montantJournalier: num(credit.montantJournalier),
    echeances:         credit.echeances.map((e) => ({
      numeroEcheance: e.numeroEcheance,
      dateEcheance:   e.dateEcheance.toISOString(),
      montantDu:      num(e.montantDu),
      montantPaye:    num(e.montantPaye),
      statut:         e.statut,
    })),
  });

  const nbPayes    = rows.filter((r) => r.statut === "PAYE").length;
  const nbRetards  = rows.filter((r) => r.statut === "EN_RETARD").length;
  const clientNom  = `${credit.client.prenom} ${credit.client.nom}`;
  const agent      = credit.client.agentTerrain ? `${credit.client.agentTerrain.prenom} ${credit.client.agentTerrain.nom}` : "—";
  const pdv        = credit.client.pointDeVente?.nom ?? "—";

  const STATUT_CELL: Record<string, { label: string; cls: string }> = {
    PAYE:      { label: "Payé",     cls: "bg-emerald-100 text-emerald-700" },
    EN_RETARD: { label: "En retard", cls: "bg-red-100 text-red-700" },
    A_VENIR:   { label: "À venir",  cls: "bg-slate-100 text-slate-400" },
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">

        {/* En-tête */}
        <header className="flex items-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/afrisime-logo.svg" alt="AFRISIME" className="h-10 w-auto" />
          <div className="ml-auto text-right">
            <p className="text-xs text-slate-400">Suivi de crédit</p>
            <p className="font-mono text-sm font-semibold text-slate-700">{credit.reference}</p>
          </div>
        </header>

        {/* Carte client */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{clientNom}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Code client : <span className="font-mono font-medium text-slate-700">{credit.client.codeClient ?? "—"}</span>
                {credit.client.sexe && <span className="text-slate-400"> · {SEXE_LABEL[credit.client.sexe] ?? credit.client.sexe}</span>}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {STATUT_CREDIT_LABEL[credit.statut] ?? credit.statut}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-sm">
            <div><p className="text-xs text-slate-400">Point de vente</p><p className="font-medium">{pdv}</p></div>
            <div><p className="text-xs text-slate-400">Agent affecté</p><p className="font-medium">{agent}</p></div>
            <div><p className="text-xs text-slate-400">Date d&apos;octroi</p><p className="font-medium">{fmtDate(credit.createdAt)}</p></div>
          </div>
        </section>

        {/* Progression */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700">Évolution du remboursement</h2>
            <span className="text-sm font-bold text-emerald-700">{pct}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Montant total</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{fmt(montantTotal)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-xs text-emerald-600">Déjà remboursé</p>
              <p className="text-sm font-bold text-emerald-700 mt-0.5">{fmt(montantRembourse)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-xs text-amber-600">Reste à payer</p>
              <p className="text-sm font-bold text-amber-700 mt-0.5">{fmt(soldeRestant)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
            <span>Durée : <b className="text-slate-700">{credit.dureeJours} jour(s)</b></span>
            <span>Jours payés : <b className="text-emerald-700">{nbPayes}</b></span>
            {nbRetards > 0 && <span>En retard : <b className="text-red-600">{nbRetards}</b></span>}
            <span className="ml-auto">Fin prévue : <b className="text-slate-700">{fmtDate(credit.dateEcheanceFin)}</b></span>
          </div>
        </section>

        {/* Calendrier journalier */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Calendrier journalier</h2>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Échéancier non encore disponible.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 bg-slate-50">
                    <th className="px-4 py-2 font-medium">Jour</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium text-right">Prévu</th>
                    <th className="px-4 py-2 font-medium text-right">Payé</th>
                    <th className="px-4 py-2 font-medium text-right">Solde</th>
                    <th className="px-4 py-2 font-medium text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const s = STATUT_CELL[r.statut];
                    return (
                      <tr key={r.jour} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-center text-slate-500">{r.jour}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{fmt(r.montantPrevu)}</td>
                        <td className={`px-4 py-2 text-right font-medium ${r.montantPaye > 0 ? "text-emerald-700" : "text-slate-400"}`}>{fmt(r.montantPaye)}</td>
                        <td className="px-4 py-2 text-right text-slate-700">{fmt(r.soldeRestant)}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-center text-xs text-slate-400 mt-6">
          AFRISIME — Réinventer la distribution pour une Afrique plus prospère.<br />
          Ce suivi est fourni à titre informatif. Pour toute question, contactez votre agent.
        </p>
      </div>
    </div>
  );
}
