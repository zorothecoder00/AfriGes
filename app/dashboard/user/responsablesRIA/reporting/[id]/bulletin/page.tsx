"use client";

import { use } from "react";
import { useApi } from "@/hooks/useApi";
import { RefreshCw, Printer } from "lucide-react";

interface RapportDetaille {
  id: number; mois: number; annee: number;
  donnees: {
    portefeuille: { reference: string; nom: string | null; investisseur: string; email: string | null };
    periode: { mois: number; annee: number };
    capitaux: {
      capitalInvesti: number; capitalDisponible: number; capitalEngage: number;
      capitalRecouvre: number; capitalBloque: number;
    };
    benefices: { generes: number; distribues: number; reinvestis: number; fondSecurite: number };
    distribution: {
      capitalBase: number; montantGenere: number; montantDistribue: number;
      montantReinvesti: number; montantSecurite: number; statut: string; datePaiement: string | null;
    } | null;
    financementsActifs: number; financementsEnRetard: number; financementsRembourses: number;
    mouvementsMois: { entrees: number; sorties: number; solde: number; count: number };
    genereLe: string;
  };
  portefeuille: {
    reference: string; nom: string | null;
    profilRIA: { gestionnaire: { member: { nom: string; prenom: string; email: string | null; telephone: string | null } } } | null;
  };
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " FCFA";
}
function moisLabel(m: number, a: number) {
  return new Date(a, m - 1).toLocaleString("fr-FR", { month: "long", year: "numeric" });
}

export default function BulletinRIAPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error } = useApi<{ rapport: RapportDetaille }>(`/api/admin/ria/reporting/${id}`);

  if (loading) return (
    <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
      <RefreshCw className="w-5 h-5 animate-spin" /> Chargement du rapport…
    </div>
  );
  if (error || !data?.rapport) return <div className="p-8 text-red-600">Rapport introuvable.</div>;

  const { rapport } = data;
  const d  = rapport.donnees;
  const pf = rapport.portefeuille;
  const investisseur = pf.profilRIA?.gestionnaire?.member;

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <div className="max-w-3xl mx-auto mb-4 flex justify-end print:hidden">
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg">
          <Printer className="w-4 h-4" /> Imprimer / PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-xl p-10 print:shadow-none print:rounded-none print:p-8">
        <div className="flex items-start justify-between border-b-2 border-emerald-600 pb-6 mb-6">
          <div>
            <h1 className="text-xl font-bold text-emerald-700">AfriGes — Réseau des Investisseurs AfriSime</h1>
            <p className="text-slate-500 text-sm mt-1">Relevé mensuel de portefeuille</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-700">{pf.reference}</p>
            {pf.nom && <p className="text-xs text-slate-500">{pf.nom}</p>}
            <p className="text-lg font-bold text-slate-800 mt-1">{moisLabel(rapport.mois, rapport.annee)}</p>
          </div>
        </div>

        <div className="mb-6 bg-slate-50 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase font-medium mb-2">Investisseur</p>
          <p className="font-semibold text-slate-800">
            {investisseur ? `${investisseur.prenom} ${investisseur.nom}` : d.portefeuille.investisseur}
          </p>
          {investisseur?.email && <p className="text-sm text-slate-500">{investisseur.email}</p>}
          {investisseur?.telephone && <p className="text-sm text-slate-500">{investisseur.telephone}</p>}
        </div>

        <section className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 border-b border-slate-100 pb-1">
            Situation des Capitaux
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {[
                ["Capital investi total",   fmt(d.capitaux.capitalInvesti),    "font-semibold"],
                ["Capital disponible",      fmt(d.capitaux.capitalDisponible), "text-emerald-700"],
                ["Capital engagé",          fmt(d.capitaux.capitalEngage),     "text-blue-700"],
                ["Capital recouvré",        fmt(d.capitaux.capitalRecouvre),   "text-slate-700"],
                ["Capital bloqué",          fmt(d.capitaux.capitalBloque),     d.capitaux.capitalBloque > 0 ? "text-red-600" : "text-slate-400"],
              ].map(([label, valeur, cls]) => (
                <tr key={label} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-500">{label}</td>
                  <td className={`py-1.5 text-right ${cls}`}>{valeur}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {d.distribution && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 border-b border-slate-100 pb-1">
              Bénéfices — {moisLabel(rapport.mois, rapport.annee)}
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["Base de calcul",           fmt(d.distribution.capitalBase),      "text-slate-600"],
                  ["Montant généré",            fmt(d.distribution.montantGenere),    "font-medium text-slate-800"],
                  ["→ Part investisseur",       fmt(d.distribution.montantDistribue), "text-emerald-700 pl-4"],
                  ["→ Réinvesti",               fmt(d.distribution.montantReinvesti), "text-blue-600 pl-4"],
                  ["→ Fonds sécurité",          fmt(d.distribution.montantSecurite),  "text-amber-600 pl-4"],
                ].map(([label, valeur, cls]) => (
                  <tr key={label} className="border-b border-slate-50">
                    <td className="py-1.5 text-slate-500">{label}</td>
                    <td className={`py-1.5 text-right ${cls}`}>{valeur}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={`mt-2 text-xs px-2 py-1 rounded inline-block ${d.distribution.statut === "DISTRIBUE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {d.distribution.statut === "DISTRIBUE"
                ? `Distribué le ${d.distribution.datePaiement ? new Date(d.distribution.datePaiement).toLocaleDateString("fr-FR") : "—"}`
                : "En attente de distribution"}
            </div>
          </section>
        )}

        <section className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 border-b border-slate-100 pb-1">
            Activité de Financement
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label: "Actifs",     value: d.financementsActifs,     color: "text-blue-600" },
              { label: "En retard",  value: d.financementsEnRetard,   color: d.financementsEnRetard > 0 ? "text-red-600" : "text-slate-400" },
              { label: "Soldés",     value: d.financementsRembourses, color: "text-emerald-600" },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 rounded-lg p-3">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 border-b border-slate-100 pb-1">
            Flux du Mois
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-50">
                <td className="py-1.5 text-slate-500">Entrées</td>
                <td className="py-1.5 text-right text-emerald-600">{fmt(d.mouvementsMois.entrees)}</td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="py-1.5 text-slate-500">Sorties</td>
                <td className="py-1.5 text-right text-red-600">{fmt(d.mouvementsMois.sorties)}</td>
              </tr>
              <tr>
                <td className="py-1.5 font-medium text-slate-700">Solde net</td>
                <td className={`py-1.5 text-right font-semibold ${d.mouvementsMois.solde >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {fmt(d.mouvementsMois.solde)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <div className="border-t border-slate-200 pt-4 mt-8 flex justify-between text-xs text-slate-400">
          <span>Généré le {new Date(d.genereLe).toLocaleDateString("fr-FR")} via AfriGes</span>
          <span>Document non contractuel — usage interne</span>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
