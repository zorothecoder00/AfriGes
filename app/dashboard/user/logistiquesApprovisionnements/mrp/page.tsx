"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import RetourApprovisionnement from "@/components/RetourApprovisionnement";
import {
  Calculator, RefreshCw, Info, FileSearch, ChevronDown, ChevronUp,
} from "lucide-react";

interface PdvRef { id: number; nom: string; code: string }
interface LigneMRP {
  produit: { id: number; nom: string; codeProduit: string | null; fournisseurPrincipalId: number | null; prixAchat: number | string | null };
  pointDeVente: PdvRef;
  previsionVentes: number; moyenneMensuelleVentes: number; demandeFermeNonCouverte: number;
  stockSecurite: number; stockDisponible: number; stockEnTransit: number; commandesEnCours: number;
  besoinNet: number; horizonMois: number;
}
interface AgregatProduit { produitId: number; produitNom: string; codeProduit: string | null; besoinNetTotal: number; detailPdv: { pdvNom: string; besoinNet: number }[] }
interface MRPResponse {
  data: LigneMRP[]; agregatParProduit: AgregatProduit[] | null;
  stats: { produitsAAnalyser: number; produitsABesoin: number; besoinTotalUnites: number };
  parametres: { horizonMois: number; moisHistorique: number };
}

const inputCls = "px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500";

export default function MRPPage() {
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [horizonMois, setHorizonMois] = useState("1");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: pdvData } = useApi<{ data: PdvRef[] }>("/api/admin/pdv?limit=200");
  const pdvs = pdvData?.data ?? [];

  const params = new URLSearchParams({ horizonMois });
  if (pointDeVenteId) params.set("pointDeVenteId", pointDeVenteId);
  if (search) params.set("search", search);
  const { data, loading, refetch } = useApi<MRPResponse>(`/api/logistique/mrp?${params}`);

  const lignes = data?.data ?? [];
  const agregat = data?.agregatParProduit;
  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <RetourApprovisionnement />
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-emerald-600" /> Planification des besoins (MRP)
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Besoin = Prévision ventes + Stock sécurité − Stock disponible − Commandes en cours</p>
          </div>
          <button onClick={refetch} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2 text-sm text-blue-800">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Prévision ventes = moyenne mensuelle des sorties clients des {data?.parametres.moisHistorique ?? 3} derniers mois × horizon,
            plus la demande ferme non couverte (souscriptions déjà confirmées + crédits clients déjà validés non encore livrés). La saisonnalité et l&apos;effet des promotions ne sont pas modélisés automatiquement — ajustez la quantité si nécessaire avant de créer une RFQ.
          </p>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
          <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={inputCls}>
            <option value="">Tous les PDV (agrégé)</option>
            {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
          </select>
          <select value={horizonMois} onChange={(e) => setHorizonMois(e.target.value)} className={inputCls}>
            <option value="1">Horizon : 1 mois</option>
            <option value="2">Horizon : 2 mois</option>
            <option value="3">Horizon : 3 mois</option>
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un produit…" className={`${inputCls} flex-1 min-w-40`} />
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Produits analysés</p>
              <p className="text-xl font-bold text-slate-900">{stats.produitsAAnalyser}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Produits à commander</p>
              <p className="text-xl font-bold text-amber-600">{stats.produitsABesoin}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Besoin total (unités)</p>
              <p className="text-xl font-bold text-slate-900">{stats.besoinTotalUnites.toLocaleString("fr-FR")}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Calcul en cours…</div>
        ) : !pointDeVenteId && agregat ? (
          // ── Vue agrégée tous PDV ──
          agregat.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {agregat.map((a) => (
                <div key={a.produitId}>
                  <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
                    <button onClick={() => setExpanded(expanded === a.produitId ? null : a.produitId)} className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0">
                      {expanded === a.produitId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{a.produitNom}</p>
                      <p className="text-xs text-slate-400">{a.detailPdv.length} agence(s) concernée(s)</p>
                    </div>
                    <span className="text-sm font-bold text-amber-600 flex-shrink-0">{a.besoinNetTotal.toLocaleString("fr-FR")} unité(s)</span>
                    <RfqLink produitId={a.produitId} produitNom={a.produitNom} quantite={a.besoinNetTotal} />
                  </div>
                  {expanded === a.produitId && (
                    <div className="px-5 pb-4 pl-14">
                      <div className="bg-slate-50 rounded-lg divide-y divide-slate-100">
                        {a.detailPdv.map((d, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 text-xs text-slate-600">
                            <span>{d.pdvNom}</span>
                            <span className="font-medium">{d.besoinNet.toLocaleString("fr-FR")} unité(s)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : lignes.length === 0 ? (
          <EmptyState />
        ) : (
          // ── Vue détaillée par PDV ──
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Produit</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">PDV</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">Prévision</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">Sécurité</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">Disponible</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">En cours</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">Besoin net</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lignes.map((l, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-slate-800">{l.produit.nom}</p>
                        {l.produit.codeProduit && <p className="text-xs text-slate-400 font-mono">{l.produit.codeProduit}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{l.pointDeVente.nom}</td>
                      <td className="text-center px-3 py-2.5">{l.previsionVentes}</td>
                      <td className="text-center px-3 py-2.5 text-slate-500">{l.stockSecurite}</td>
                      <td className="text-center px-3 py-2.5 text-slate-500">{l.stockDisponible}{l.stockEnTransit > 0 ? ` (+${l.stockEnTransit} transit)` : ""}</td>
                      <td className="text-center px-3 py-2.5 text-slate-500">{l.commandesEnCours}</td>
                      <td className="text-center px-3 py-2.5 font-bold text-amber-600">{l.besoinNet}</td>
                      <td className="text-center px-3 py-2.5">
                        <RfqLink produitId={l.produit.id} produitNom={l.produit.nom} quantite={l.besoinNet} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RfqLink({ produitId, produitNom, quantite }: { produitId: number; produitNom: string; quantite: number }) {
  const qp = new URLSearchParams({ produitId: String(produitId), produitNom, quantite: String(quantite) });
  return (
    <Link href={`/dashboard/user/logistiquesApprovisionnements/rfq?${qp}`}
      className="flex-shrink-0 flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
      <FileSearch className="w-3.5 h-3.5" /> Créer une RFQ
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
      <Calculator className="w-10 h-10 mb-2 opacity-30" />
      <p className="text-sm">Aucun besoin identifié pour ces critères</p>
    </div>
  );
}
