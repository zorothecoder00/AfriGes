"use client";

import React, { useState } from "react";
import {
  Package, Truck, AlertTriangle, ArrowRightLeft, BarChart3,
  ClipboardList, CheckCircle, XCircle, Clock, RefreshCw, Store,
  TrendingDown, TrendingUp, ChevronLeft, ChevronRight, Search,
  ExternalLink, Calendar, User, Layers,
} from "lucide-react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";

// ─── Types communs ────────────────────────────────────────────────────────────

interface PDV { id: number; nom: string; code: string; type?: string }

// ─── Types Stock ──────────────────────────────────────────────────────────────

interface StockItem {
  id: number; nom: string; reference?: string | null; unite?: string | null;
  prixUnitaire: string; prixAchat?: string | null; valeurStock: number;
  quantite: number; quantiteReservee: number; quantiteEnTransit: number;
  quantiteEndommagee: number; alerteStock: number;
  pointDeVente: PDV;
}
interface StockResponse {
  data: StockItem[];
  pdvs: PDV[];
  userPdvId: number | null;
  stats: { totalProduits: number; enRupture: number; faibleCount: number; surstockCount: number; valeurTotale: number; totalEndommage: number; pctEndommage: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Types Réceptions ─────────────────────────────────────────────────────────

interface Reception {
  id: number; reference: string; type: "FOURNISSEUR" | "INTERNE";
  statut: "BROUILLON" | "EN_COURS" | "RECU" | "VALIDE" | "ANNULE";
  datePrevisionnelle: string; dateReception?: string | null;
  fournisseurNom?: string | null; notes?: string | null;
  pointDeVente: PDV;
  receptionnePar: { nom: string; prenom: string };
  lignes: { produit: { nom: string; unite?: string | null }; quantiteAttendue: number; quantiteRecue?: number | null }[];
}
interface ReceptionsResponse {
  data: Reception[];
  stats: { pendingApproval: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Types Livraisons packs ───────────────────────────────────────────────────

interface LivraisonPack {
  id: number; statut: "PLANIFIEE" | "EN_ROUTE" | "LIVREE" | "ANNULEE";
  datePrevisionnelle: string; dateLivraison?: string | null; livreurNom?: string | null;
  pointDeVente?: PDV | null;
  souscription: {
    pack: { nom: string; type: string };
    client?: { nom: string; prenom: string; telephone?: string } | null;
  };
  lignes: { produit: { nom: string; prixUnitaire: string }; quantite: number; prixUnitaire: string }[];
}
interface LivraisonsPackResponse {
  planifiees: LivraisonPack[]; livreesRecentes: LivraisonPack[];
  stats: { totalPlanifiees: number; totalLivrees: number };
}

// ─── Types Transferts ─────────────────────────────────────────────────────────

interface Transfert {
  id: number; reference?: string | null;
  statut: "EN_ATTENTE" | "EN_TRANSIT" | "RECU" | "ANNULE";
  dateCreation: string; dateReception?: string | null; notes?: string | null;
  origine: PDV; destination: PDV;
  creePar: { nom: string; prenom: string };
  lignes: { produit: { nom: string; unite?: string | null }; quantite: number }[];
}
interface TransfertsResponse {
  data: Transfert[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Types Anomalies ──────────────────────────────────────────────────────────

interface Anomalie {
  id: number; type: string; description: string;
  statut: "EN_ATTENTE" | "EN_COURS" | "RESOLUE" | "IGNOREE";
  createdAt: string;
  produit: { nom: string };
  pointDeVente: PDV;
  magasinier: { nom: string; prenom: string };
}
interface AnomaliesResponse {
  data: Anomalie[];
  stats: { pendingCount: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Types Prévisions ─────────────────────────────────────────────────────────

interface Prevision {
  produitId: number;
  produit: { id: number; nom: string; unite?: string | null } | null;
  pointDeVenteId: number | null;
  pointDeVente: PDV | null;
  totalQuantite: number; totalEstime: number; nbSouscriptions: number;
}
interface PrevisionsResponse {
  previsions: Prevision[];
  stats: { totalProduits: number; totalQuantite: number; totalPdvs: number };
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

const STATUT_RECEPTION: Record<Reception["statut"], { label: string; bg: string; text: string }> = {
  BROUILLON: { label: "En attente",  bg: "bg-amber-100",   text: "text-amber-700"   },
  EN_COURS:  { label: "En cours",    bg: "bg-blue-100",    text: "text-blue-700"    },
  RECU:      { label: "Reçue",       bg: "bg-violet-100",  text: "text-violet-700"  },
  VALIDE:    { label: "Validée",     bg: "bg-emerald-100", text: "text-emerald-700" },
  ANNULE:    { label: "Annulée",     bg: "bg-slate-100",   text: "text-slate-500"   },
};

const STATUT_TRANSFERT: Record<Transfert["statut"], { label: string; bg: string; text: string }> = {
  EN_ATTENTE: { label: "En attente", bg: "bg-amber-100",   text: "text-amber-700"   },
  EN_TRANSIT: { label: "En transit", bg: "bg-blue-100",    text: "text-blue-700"    },
  RECU:       { label: "Reçu",       bg: "bg-emerald-100", text: "text-emerald-700" },
  ANNULE:     { label: "Annulé",     bg: "bg-slate-100",   text: "text-slate-500"   },
};

const STATUT_ANOMALIE: Record<Anomalie["statut"], { label: string; bg: string; text: string }> = {
  EN_ATTENTE: { label: "À traiter",  bg: "bg-red-100",     text: "text-red-700"     },
  EN_COURS:   { label: "En cours",   bg: "bg-amber-100",   text: "text-amber-700"   },
  RESOLUE:    { label: "Résolue",    bg: "bg-emerald-100", text: "text-emerald-700" },
  IGNOREE:    { label: "Ignorée",    bg: "bg-slate-100",   text: "text-slate-500"   },
};

function Badge({ bg, text, children }: { bg: string; text: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold ${bg} ${text}`}>{children}</span>;
}

function Spinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
}

function Empty({ label }: { label: string }) {
  return <div className="text-center py-14 text-slate-400"><Package size={36} className="mx-auto mb-3 opacity-25" /><p className="font-medium">{label}</p></div>;
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"><ChevronLeft size={15} /></button>
      <span className="text-sm text-slate-600 font-medium">{page} / {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"><ChevronRight size={15} /></button>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, sub, color, urgent }: {
  icon: React.ReactNode; value: string | number; label: string;
  sub?: string; color: string; urgent?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-4 ${urgent ? "border-red-200 ring-1 ring-red-100" : "border-slate-200"}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <div>
        <p className={`text-2xl font-bold ${urgent ? "text-red-600" : "text-slate-800"}`}>{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Tab : Stock ──────────────────────────────────────────────────────────────

function TabStock() {
  const [search, setSearch] = useState("");
  const [enRupture, setEnRupture] = useState(false);
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search)    params.set("search", search);
  if (enRupture) params.set("enRupture", "true");

  const { data, loading } = useApi<StockResponse>(`/api/logistique/stock?${params}`);
  const items = data?.data ?? [];
  const meta  = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Chercher un produit…"
            className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none"
          />
        </div>
        <button onClick={() => { setEnRupture(v => !v); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${enRupture ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
          <TrendingDown size={14} /> En rupture
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? <Spinner /> : items.length === 0 ? <Empty label="Aucun produit" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 text-left">Produit</th>
                    <th className="px-5 py-3 text-left">PDV</th>
                    <th className="px-5 py-3 text-right">En stock</th>
                    <th className="px-5 py-3 text-right">Réservé</th>
                    <th className="px-5 py-3 text-right">En transit</th>
                    <th className="px-5 py-3 text-right">Endommagé</th>
                    <th className="px-5 py-3 text-right">Valeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(s => {
                    const rupture = s.quantite === 0;
                    const faible  = s.quantite > 0 && s.quantite <= s.alerteStock;
                    return (
                      <tr key={`${s.id}-${s.pointDeVente.id}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-slate-800">{s.nom}</p>
                          {s.reference && <p className="text-xs text-slate-400 font-mono">{s.reference}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                            <Store size={11} /> {s.pointDeVente.nom}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`font-mono font-bold ${rupture ? "text-red-600" : faible ? "text-amber-600" : "text-emerald-700"}`}>
                            {s.quantite}
                          </span>
                          {s.unite && <span className="text-xs text-slate-400 ml-1">{s.unite}</span>}
                          {rupture && <Badge bg="bg-red-100" text="text-red-600"> Rupture</Badge>}
                          {faible  && <Badge bg="bg-amber-100" text="text-amber-600"> Faible</Badge>}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-500 text-sm">{s.quantiteReservee}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-500 text-sm">{s.quantiteEnTransit}</td>
                        <td className="px-5 py-3.5 text-right">
                          {s.quantiteEndommagee > 0
                            ? <span className="font-mono text-orange-600 font-medium">{s.quantiteEndommagee}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-700 font-medium text-sm">{formatCurrency(s.valeurStock)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tab : Réceptions ─────────────────────────────────────────────────────────

function TabReceptions() {
  const [filterStatut, setFilterStatut] = useState("EN_COURS");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "15" });
  if (filterStatut) params.set("statut", filterStatut);

  const { data, loading } = useApi<ReceptionsResponse>(`/api/logistique/receptions?${params}`);
  const items = data?.data ?? [];
  const meta  = data?.meta;

  const FILTRES = [
    { value: "BROUILLON", label: "En attente" },
    { value: "EN_COURS",  label: "En cours" },
    { value: "RECU",      label: "Reçues" },
    { value: "VALIDE",    label: "Validées" },
    { value: "",          label: "Toutes" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {FILTRES.map(f => (
          <button key={f.value} onClick={() => { setFilterStatut(f.value); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${filterStatut === f.value ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? <Spinner /> : items.length === 0 ? <Empty label="Aucune réception" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 text-left">Référence</th>
                    <th className="px-5 py-3 text-left">Fournisseur / Source</th>
                    <th className="px-5 py-3 text-left">PDV</th>
                    <th className="px-5 py-3 text-left">Date prévisionnelle</th>
                    <th className="px-5 py-3 text-right">Lignes</th>
                    <th className="px-5 py-3 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(r => {
                    const cfg = STATUT_RECEPTION[r.statut];
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-mono font-medium text-slate-800 text-xs">{r.reference}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{r.type === "FOURNISSEUR" ? "Fournisseur" : "Interne"}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700">{r.fournisseurNom ?? "—"}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-slate-600 text-xs"><Store size={11} /> {r.pointDeVente.nom}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-slate-600 text-xs"><Calendar size={11} /> {formatDate(r.datePrevisionnelle)}</div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium text-xs">{r.lignes.length}</span>
                        </td>
                        <td className="px-5 py-3.5"><Badge bg={cfg.bg} text={cfg.text}>{cfg.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tab : Livraisons packs ───────────────────────────────────────────────────

function TabLivraisonsPacks() {
  const { data, loading } = useApi<LivraisonsPackResponse>("/api/logistique/livraisons-packs");
  const planifiees      = data?.planifiees      ?? [];
  const livreesRecentes = data?.livreesRecentes ?? [];

  const PACK_BADGE: Record<string, string> = {
    ALIMENTAIRE: "bg-green-100 text-green-800", REVENDEUR: "bg-blue-100 text-blue-800",
    FAMILIAL: "bg-purple-100 text-purple-800",  URGENCE: "bg-red-100 text-red-800",
    EPARGNE_PRODUIT: "bg-amber-100 text-amber-800", FIDELITE: "bg-pink-100 text-pink-800",
  };

  const LivraisonRow = ({ l }: { l: LivraisonPack }) => (
    <tr className="hover:bg-slate-50/80 transition-colors">
      <td className="px-5 py-3.5">
        <p className="font-medium text-slate-800">{l.souscription.client ? `${l.souscription.client.prenom} ${l.souscription.client.nom}` : "—"}</p>
        {l.souscription.client?.telephone && <p className="text-xs text-slate-400">{l.souscription.client.telephone}</p>}
      </td>
      <td className="px-5 py-3.5">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PACK_BADGE[l.souscription.pack.type] ?? "bg-slate-100 text-slate-600"}`}>
          {l.souscription.pack.nom}
        </span>
      </td>
      <td className="px-5 py-3.5">
        {l.pointDeVente ? <div className="flex items-center gap-1.5 text-slate-600 text-xs"><Store size={11} /> {l.pointDeVente.nom}</div> : <span className="text-slate-400 text-xs">—</span>}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1.5 text-slate-600 text-xs"><Calendar size={11} /> {formatDate(l.datePrevisionnelle)}</div>
        {l.livreurNom && <p className="text-xs text-slate-400 mt-0.5"><User size={10} className="inline mr-0.5" />{l.livreurNom}</p>}
      </td>
      <td className="px-5 py-3.5 text-right">
        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium text-xs">{l.lignes.length}</span>
      </td>
    </tr>
  );

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Planifiées */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Clock size={14} className="text-amber-500" /> À livrer ({planifiees.length})
        </h3>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {planifiees.length === 0 ? <Empty label="Aucune livraison planifiée" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Client</th><th className="px-5 py-3 text-left">Pack</th>
                  <th className="px-5 py-3 text-left">PDV</th><th className="px-5 py-3 text-left">Date prévue</th>
                  <th className="px-5 py-3 text-right">Produits</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">{planifiees.map(l => <LivraisonRow key={l.id} l={l} />)}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Récentes livrées */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <CheckCircle size={14} className="text-emerald-500" /> Livrées récemment (30j) ({livreesRecentes.length})
        </h3>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {livreesRecentes.length === 0 ? <Empty label="Aucune livraison récente" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Client</th><th className="px-5 py-3 text-left">Pack</th>
                  <th className="px-5 py-3 text-left">PDV</th><th className="px-5 py-3 text-left">Date livrée</th>
                  <th className="px-5 py-3 text-right">Produits</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">{livreesRecentes.map(l => <LivraisonRow key={l.id} l={l} />)}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab : Transferts ─────────────────────────────────────────────────────────

function TabTransferts() {
  const [filterStatut, setFilterStatut] = useState("EN_TRANSIT");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "15" });
  if (filterStatut) params.set("statut", filterStatut);

  const { data, loading } = useApi<TransfertsResponse>(`/api/logistique/transferts?${params}`);
  const items = data?.data ?? [];
  const meta  = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {[
          { value: "EN_ATTENTE", label: "En attente" }, { value: "EN_TRANSIT", label: "En transit" },
          { value: "RECU", label: "Reçus" }, { value: "", label: "Tous" },
        ].map(f => (
          <button key={f.value} onClick={() => { setFilterStatut(f.value); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${filterStatut === f.value ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? <Spinner /> : items.length === 0 ? <Empty label="Aucun transfert" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 text-left">Référence</th>
                    <th className="px-5 py-3 text-left">Origine → Destination</th>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Produits</th>
                    <th className="px-5 py-3 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(t => {
                    const cfg = STATUT_TRANSFERT[t.statut];
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-mono text-slate-700 text-xs">{t.reference ?? `#${t.id}`}</p>
                          <p className="text-xs text-slate-400">{t.creePar.prenom} {t.creePar.nom}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-slate-700">{t.origine.nom}</span>
                            <ArrowRightLeft size={13} className="text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-700">{t.destination.nom}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(t.dateCreation)}</td>
                        <td className="px-5 py-3.5">
                          <div className="space-y-0.5">
                            {t.lignes.slice(0, 2).map((l, i) => (
                              <p key={i} className="text-xs text-slate-600">{l.produit.nom} · <span className="font-mono font-medium">{l.quantite}</span> {l.produit.unite ?? ""}</p>
                            ))}
                            {t.lignes.length > 2 && <p className="text-xs text-slate-400">+{t.lignes.length - 2} autres</p>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5"><Badge bg={cfg.bg} text={cfg.text}>{cfg.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tab : Anomalies ──────────────────────────────────────────────────────────

function TabAnomalies() {
  const [filterStatut, setFilterStatut] = useState("EN_ATTENTE");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "15" });
  if (filterStatut) params.set("statut", filterStatut);

  const { data, loading } = useApi<AnomaliesResponse>(`/api/logistique/anomalies?${params}`);
  const items = data?.data ?? [];
  const meta  = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {[
          { value: "EN_ATTENTE", label: "À traiter" }, { value: "EN_COURS", label: "En cours" },
          { value: "RESOLUE", label: "Résolues" }, { value: "", label: "Toutes" },
        ].map(f => (
          <button key={f.value} onClick={() => { setFilterStatut(f.value); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${filterStatut === f.value ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? <Spinner /> : items.length === 0 ? <Empty label="Aucune anomalie" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 text-left">Produit</th>
                    <th className="px-5 py-3 text-left">PDV</th>
                    <th className="px-5 py-3 text-left">Description</th>
                    <th className="px-5 py-3 text-left">Signalé par</th>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(a => {
                    const cfg = STATUT_ANOMALIE[a.statut];
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                              <Package size={12} className="text-orange-600" />
                            </div>
                            <p className="font-medium text-slate-800">{a.produit.nom}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600"><Store size={11} className="inline mr-1" />{a.pointDeVente.nom}</td>
                        <td className="px-5 py-3.5 max-w-[220px]">
                          <p className="text-slate-700 truncate text-xs" title={a.description}>{a.description}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{a.type}</p>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">{a.magasinier.prenom} {a.magasinier.nom}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(a.createdAt)}</td>
                        <td className="px-5 py-3.5"><Badge bg={cfg.bg} text={cfg.text}>{cfg.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tab : Prévisions souscriptions ──────────────────────────────────────────

function TabPrevisions() {
  const { data, loading } = useApi<PrevisionsResponse>("/api/logistique/previsions");
  const previsions = data?.previsions ?? [];
  const stats      = data?.stats;

  return (
    <div className="space-y-4">
      {/* Mini stats */}
      {stats && stats.totalProduits > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">{stats.totalProduits}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Produits distincts</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{stats.totalQuantite.toLocaleString("fr-FR")}</p>
            <p className="text-xs text-blue-600 mt-0.5">Quantité totale demandée</p>
          </div>
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-violet-700">{stats.totalPdvs}</p>
            <p className="text-xs text-violet-600 mt-0.5">PDVs concernés</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <BarChart3 size={14} className="text-emerald-600" />
            Demandes confirmées par produit × PDV
          </p>
          <Link href="/dashboard/gestionnaire/logistique/previsions"
            className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
            Voir détail complet <ExternalLink size={11} />
          </Link>
        </div>

        {loading ? <Spinner /> : previsions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <BarChart3 size={36} className="mx-auto mb-3 opacity-25" />
            <p className="font-medium text-sm">Aucune prévision</p>
            <p className="text-xs mt-1">Les prévisions apparaissent dès que des lignes sont confirmées</p>
            <Link href="/dashboard/gestionnaire/logistique/demandes"
              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline mt-2">
              Traiter les demandes en attente →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Produit</th>
                  <th className="px-5 py-3 text-left">PDV</th>
                  <th className="px-5 py-3 text-right">Qté demandée</th>
                  <th className="px-5 py-3 text-right">Souscriptions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previsions.slice(0, 15).map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                          <Package size={12} className="text-emerald-600" />
                        </div>
                        <p className="font-medium text-slate-800">{p.produit?.nom ?? `#${p.produitId}`}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      {p.pointDeVente ? <><Store size={11} className="inline mr-1" />{p.pointDeVente.nom}</> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-mono font-bold text-slate-800">{p.totalQuantite.toLocaleString("fr-FR")}</span>
                      {p.produit?.unite && <span className="text-xs text-slate-400 ml-1">{p.produit.unite}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium text-xs">{p.nbSouscriptions}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previsions.length > 15 && (
              <div className="px-5 py-3 border-t border-slate-100 text-center">
                <Link href="/dashboard/gestionnaire/logistique/previsions"
                  className="text-xs text-emerald-600 hover:underline flex items-center justify-center gap-1">
                  Voir les {previsions.length - 15} autres lignes <ExternalLink size={10} />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type TabId = "stock" | "receptions" | "livraisons" | "transferts" | "anomalies" | "previsions";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "stock",      label: "Stock",               icon: <Package size={15} /> },
  { id: "receptions", label: "Réceptions",           icon: <Truck size={15} /> },
  { id: "livraisons", label: "Livraisons packs",     icon: <ClipboardList size={15} /> },
  { id: "transferts", label: "Transferts",           icon: <ArrowRightLeft size={15} /> },
  { id: "anomalies",  label: "Anomalies",            icon: <AlertTriangle size={15} /> },
  { id: "previsions", label: "Prévisions",           icon: <BarChart3 size={15} /> },
];

export default function LogistiqueDashboardPage() {
  const [tab, setTab] = useState<TabId>("stock");

  // Stats KPI (fetches légers)
  const { data: stockStats }      = useApi<StockResponse>("/api/logistique/stock?limit=1");
  const { data: livraisonsStats } = useApi<LivraisonsPackResponse>("/api/logistique/livraisons-packs");
  const { data: anomaliesStats }  = useApi<AnomaliesResponse>("/api/logistique/anomalies?limit=1");
  const { data: ajustementsStats }= useApi<{ stats: { pendingCount: number } }>("/api/logistique/ajustements?limit=1");
  const { data: receptionsStats } = useApi<ReceptionsResponse>("/api/logistique/receptions?statut=EN_COURS&limit=1");
  const { data: previsionsStats } = useApi<PrevisionsResponse>("/api/logistique/previsions");

  const enRupture        = stockStats?.stats.enRupture             ?? 0;
  const stockFaible      = stockStats?.stats.faibleCount           ?? 0;
  const valeurTotale     = stockStats?.stats.valeurTotale          ?? 0;
  const livraisonsPlan   = livraisonsStats?.stats.totalPlanifiees  ?? 0;
  const anomaliesPending = anomaliesStats?.stats.pendingCount      ?? 0;
  const ajustPending     = ajustementsStats?.stats.pendingCount    ?? 0;
  const receptionsEC     = receptionsStats?.meta.total             ?? 0;
  const previsionsProd   = previsionsStats?.stats.totalProduits    ?? 0;

  const pdvNom = stockStats?.pdvs?.find(p => p.id === stockStats.userPdvId)?.nom;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-emerald-50/10 font-['DM_Sans',sans-serif] p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2 transition-colors">
              <ChevronLeft size={15} /> Retour au dashboard
            </Link>
            <h1 className="text-3xl font-bold text-slate-800">Dashboard Logistique</h1>
            <div className="flex items-center gap-3 mt-1 text-slate-500 text-sm flex-wrap">
              {pdvNom && <span className="flex items-center gap-1.5"><Store size={13} />{pdvNom}</span>}
              <span className="flex items-center gap-1.5"><Layers size={13} />Approvisionnement &amp; stocks</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/gestionnaire/logistique/demandes"
              className="flex items-center gap-2 px-3 py-2 bg-white border border-amber-200 hover:bg-amber-50 text-amber-700 rounded-xl text-xs font-medium transition-colors shadow-sm">
              <ClipboardList size={13} /> Demandes produits
            </Link>
            <Link href="/dashboard/gestionnaire/logistique/previsions"
              className="flex items-center gap-2 px-3 py-2 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium transition-colors shadow-sm">
              <BarChart3 size={13} /> Prévisions
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<TrendingDown size={20} className="text-red-600" />}    value={enRupture}      label="Produits en rupture"    color="bg-red-100"     urgent={enRupture > 0} />
          <StatCard icon={<AlertTriangle size={20} className="text-amber-600" />} value={stockFaible}    label="Stocks faibles"         color="bg-amber-100"   urgent={stockFaible > 0} />
          <StatCard icon={<Truck size={20} className="text-blue-600" />}          value={receptionsEC}   label="Réceptions en cours"    color="bg-blue-100" />
          <StatCard icon={<Package size={20} className="text-violet-600" />}      value={livraisonsPlan} label="Livraisons packs à faire" color="bg-violet-100" urgent={livraisonsPlan > 0} />
          <StatCard icon={<XCircle size={20} className="text-orange-600" />}      value={anomaliesPending} label="Anomalies à traiter"  color="bg-orange-100"  urgent={anomaliesPending > 0} />
          <StatCard icon={<RefreshCw size={20} className="text-sky-600" />}       value={ajustPending}   label="Ajustements à pre-valider" color="bg-sky-100"  urgent={ajustPending > 0} />
          <StatCard icon={<BarChart3 size={20} className="text-emerald-600" />}   value={previsionsProd} label="Produits en prévision"  color="bg-emerald-100" />
          <StatCard icon={<TrendingUp size={20} className="text-slate-600" />}    value={formatCurrency(valeurTotale)} label="Valeur stock totale" color="bg-slate-100" />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 bg-white rounded-2xl border border-slate-200 p-1.5 w-fit shadow-sm">
          {TABS.map(t => {
            const urgent =
              (t.id === "stock"      && (enRupture > 0 || stockFaible > 0)) ||
              (t.id === "anomalies"  && anomaliesPending > 0) ||
              (t.id === "livraisons" && livraisonsPlan > 0);
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  tab === t.id ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" : "text-slate-600 hover:bg-slate-50"
                }`}>
                {t.icon} {t.label}
                {urgent && tab !== t.id && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>
            );
          })}
        </div>

        {/* Contenu du tab actif */}
        <div>
          {tab === "stock"      && <TabStock />}
          {tab === "receptions" && <TabReceptions />}
          {tab === "livraisons" && <TabLivraisonsPacks />}
          {tab === "transferts" && <TabTransferts />}
          {tab === "anomalies"  && <TabAnomalies />}
          {tab === "previsions" && <TabPrevisions />}
        </div>

      </div>
    </div>
  );
}
