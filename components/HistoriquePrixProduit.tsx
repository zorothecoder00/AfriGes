'use client';

/**
 * Historique daté des prix (achat & vente) d'un produit — lecture seule.
 * Réutilisable partout où un produit est affiché (admin, appro/logistique,
 * magasinier). L'édition des prix reste sur la fiche produit (Admin + Appro).
 *
 * Regroupement de l'affichage : Tout / Par semaine / Par mois.
 */

import { Fragment, useMemo, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { History, TrendingUp, TrendingDown, RefreshCw, Truck, Pencil, Sparkles } from 'lucide-react';

type TypeChangement = 'INITIAL' | 'ACHAT' | 'VENTE' | 'LES_DEUX';

interface EntreePrix {
  id: number;
  prixVente: number;
  prixAchat: number | null;
  margeValeur: number | null;
  margeTaux: number | null;
  type: TypeChangement;
  source: string | null;
  motif: string | null;
  receptionApproId: number | null;
  dateEffet: string;
  creePar: { id: number; nom: string; prenom: string } | null;
}

interface ProduitPrix {
  id: number;
  nom: string;
  prixUnitaire: number;
  prixAchat: number | null;
  margeValeur: number | null;
  margeTaux: number | null;
}

interface Reponse {
  data: EntreePrix[];
  produit: ProduitPrix;
}

type Regroupement = 'TOUT' | 'SEMAINE' | 'MOIS';

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** Numéro de semaine ISO 8601 + année associée. */
function semaineISO(date: Date): { annee: number; semaine: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - jour);
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semaine = Math.ceil((((d.getTime() - debutAnnee.getTime()) / 86400000) + 1) / 7);
  return { annee: d.getUTCFullYear(), semaine };
}

function clePeriode(iso: string, mode: Regroupement): { cle: string; libelle: string } {
  const d = new Date(iso);
  if (mode === 'MOIS') {
    return { cle: `${d.getFullYear()}-${d.getMonth()}`, libelle: `${MOIS[d.getMonth()]} ${d.getFullYear()}` };
  }
  const { annee, semaine } = semaineISO(d);
  return { cle: `${annee}-S${semaine}`, libelle: `Semaine ${semaine} · ${annee}` };
}

const TYPE_BADGE: Record<TypeChangement, { label: string; cls: string; icon: React.ReactNode }> = {
  INITIAL:  { label: 'Création',   cls: 'bg-slate-100 text-slate-600',   icon: <Sparkles className="w-3 h-3" /> },
  ACHAT:    { label: 'Achat',      cls: 'bg-purple-100 text-purple-700', icon: <TrendingDown className="w-3 h-3" /> },
  VENTE:    { label: 'Vente',      cls: 'bg-emerald-100 text-emerald-700', icon: <TrendingUp className="w-3 h-3" /> },
  LES_DEUX: { label: 'Achat + Vente', cls: 'bg-blue-100 text-blue-700',  icon: <RefreshCw className="w-3 h-3" /> },
};

function sourceBadge(source: string | null) {
  if (source === 'APPRO') return <span className="inline-flex items-center gap-1 text-xs text-purple-600"><Truck className="w-3 h-3" /> Appro</span>;
  if (source === 'INITIAL') return <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Sparkles className="w-3 h-3" /> Initial</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Pencil className="w-3 h-3" /> Manuel</span>;
}

interface Props {
  produitId: number | string;
}

export default function HistoriquePrixProduit({ produitId }: Props) {
  const { data, loading, error } = useApi<Reponse>(`/api/logistique/produits/${produitId}/prix`);
  const [mode, setMode] = useState<Regroupement>('TOUT');

  const entries = useMemo(() => data?.data ?? [], [data]);
  const produit = data?.produit;

  // Regroupement par période (semaine/mois) ; en mode TOUT un seul groupe plat.
  const groupes = useMemo(() => {
    if (mode === 'TOUT') return [{ cle: 'tout', libelle: '', items: entries }];
    const map = new Map<string, { libelle: string; items: EntreePrix[] }>();
    for (const e of entries) {
      const { cle, libelle } = clePeriode(e.dateEffet, mode);
      if (!map.has(cle)) map.set(cle, { libelle, items: [] });
      map.get(cle)!.items.push(e);
    }
    return Array.from(map.entries()).map(([cle, v]) => ({ cle, libelle: v.libelle, items: v.items }));
  }, [entries, mode]);

  const renderMarge = (valeur: number | null, taux: number | null) => {
    if (valeur === null) return <span className="text-slate-400">—</span>;
    const positif = valeur >= 0;
    return (
      <span className={positif ? 'text-emerald-600' : 'text-red-600'}>
        {formatCurrency(valeur)}
        {taux !== null && <span className="text-xs text-slate-400"> ({Math.round(taux)}%)</span>}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Historique des prix</h3>
            <p className="text-sm text-gray-500">Traçabilité datée des prix d&apos;achat et de vente</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {(['TOUT', 'SEMAINE', 'MOIS'] as Regroupement[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {m === 'TOUT' ? 'Tout' : m === 'SEMAINE' ? 'Par semaine' : 'Par mois'}
            </button>
          ))}
        </div>
      </div>

      {/* Prix courants */}
      {produit && (
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 text-center">
          <div className="py-3">
            <p className="text-xs text-gray-500">Prix d&apos;achat actuel</p>
            <p className="text-base font-bold text-purple-700">{produit.prixAchat !== null ? formatCurrency(produit.prixAchat) : '—'}</p>
          </div>
          <div className="py-3">
            <p className="text-xs text-gray-500">Prix de vente actuel</p>
            <p className="text-base font-bold text-emerald-700">{formatCurrency(produit.prixUnitaire)}</p>
          </div>
          <div className="py-3">
            <p className="text-xs text-gray-500">Marge actuelle</p>
            <p className="text-base font-bold">{renderMarge(produit.margeValeur, produit.margeTaux)}</p>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="p-12 text-center text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin inline mr-2" /> Chargement de l&apos;historique…
        </div>
      ) : error ? (
        <div className="p-12 text-center text-red-500 text-sm">{error}</div>
      ) : entries.length === 0 ? (
        <div className="p-12 text-center text-gray-500">Aucun changement de prix enregistré</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Date d&apos;effet</th>
                <th className="px-4 py-2 text-left font-medium">Changement</th>
                <th className="px-4 py-2 text-right font-medium">Prix d&apos;achat</th>
                <th className="px-4 py-2 text-right font-medium">Prix de vente</th>
                <th className="px-4 py-2 text-right font-medium">Marge</th>
                <th className="px-4 py-2 text-left font-medium">Source</th>
                <th className="px-4 py-2 text-left font-medium">Par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groupes.map((g) => (
                <Fragment key={g.cle}>
                  {mode !== 'TOUT' && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={7} className="px-4 py-1.5 text-xs font-semibold text-slate-600">
                        {g.libelle} · {g.items.length} changement{g.items.length > 1 ? 's' : ''}
                      </td>
                    </tr>
                  )}
                  {g.items.map((e) => {
                    const badge = TYPE_BADGE[e.type];
                    return (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">{formatDate(e.dateEffet)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                            {badge.icon} {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-purple-700">
                          {e.prixAchat !== null ? formatCurrency(e.prixAchat) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{formatCurrency(e.prixVente)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{renderMarge(e.margeValeur, e.margeTaux)}</td>
                        <td className="px-4 py-2.5">{sourceBadge(e.source)}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">
                          {e.creePar ? `${e.creePar.prenom} ${e.creePar.nom}` : '—'}
                          {e.motif && <span className="block text-slate-400 italic">{e.motif}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
