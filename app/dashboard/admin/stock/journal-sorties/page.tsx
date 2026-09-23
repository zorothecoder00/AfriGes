"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Printer, RefreshCw} from "lucide-react";import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Pagination from "@/components/ui/Pagination";
import { formatDateTime } from "@/lib/format";

/**
 * Journal des sorties de stock — vue complète des mouvements SORTIE, y compris
 * ceux qui ne produisent pas de bon de sortie (ventes directes, livraisons packs/crédit).
 */

const inputCls = "max-w-full min-w-0 px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

const TYPE_LABEL: Record<string, string> = {
  VENTE_DIRECTE: "Vente directe",
  VENTE_REVENDEUR: "Vente revendeur",
  LIVRAISON_PACK: "Livraison pack",
  LIVRAISON_CLIENT: "Livraison client / crédit",
  REMPLACEMENT_CLIENT: "Remplacement client",
  RETOUR_FOURNISSEUR: "Retour fournisseur",
  CONSOMMATION_INTERNE: "Consommation interne",
  TRANSFERT_SORTANT: "Transfert sortant",
  AJUSTEMENT_NEGATIF: "Ajustement négatif",
  PERTE: "Perte",
  CASSE: "Casse",
  VOL: "Vol",
  DON: "Don",
};

interface PDV { id: number; nom: string; code: string }
interface Ligne {
  id: number; date: string; reference: string; typeSortie: string | null; quantite: number; motif: string | null;
  produit: { id: number; nom: string; reference: string | null };
  pointDeVente: PDV | null;
  operateur: { nom: string; prenom: string } | null;
  vente: { id: number; reference: string | null } | null;
  souscriptionId: number | null;
  bonSortie: { id: number; reference: string | null } | null;
}
interface Reponse {
  data: Ligne[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  recap: { typeSortie: string | null; nombre: number; quantite: number }[];
  pdvs: PDV[];
}

export default function JournalSortiesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Chargement…</div>}>
      <JournalSorties />
    </Suspense>
  );
}

function JournalSorties() {
  // Retour contextuel : ?from=sorties → page des bons de sortie, sinon tableau de bord.
  const depuisBons = useSearchParams().get("from") === "sorties";
  const retour = depuisBons
    ? { href: "/dashboard/admin/stock/sorties", label: "Retour aux bons de sortie" }
    : { href: "/dashboard/admin", label: "Retour au tableau de bord" };
  const [page, setPage] = useState(1);
  const [typeSortie, setTypeSortie] = useState("");
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [q, setQ] = useState("");

  const params = new URLSearchParams({ page: String(page) });
  if (typeSortie) params.set("typeSortie", typeSortie);
  if (pointDeVenteId) params.set("pointDeVenteId", pointDeVenteId);
  if (debut) params.set("debut", debut);
  if (fin) params.set("fin", fin);
  if (q.trim()) params.set("q", q.trim());

  const { data, loading, refetch } = useApi<Reponse>(`/api/admin/stock/journal-sorties?${params}`);
  const lignes = data?.data ?? [];
  const recap = data?.recap ?? [];
  const pdvs = data?.pdvs ?? [];

  // Tout changement de filtre repart de la page 1.
  const filtre = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  return (
    <div className="md:p-6 max-w-6xl mx-auto space-y-4">
      <Link href={retour.href} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
        <ArrowLeft className="w-4 h-4" /> {retour.label}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Journal des sorties de stock</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Toutes les sorties : ventes directes, livraisons packs et crédit, pertes, casses, dons, transferts…
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200 dark:border-slate-700" icon={<RefreshCw size={16} />} title="Rafraîchir" />
      </div>

      {recap.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recap.map((r) => {
            const actif = typeSortie === (r.typeSortie ?? "");
            return (
              <button key={r.typeSortie ?? "aucun"} onClick={() => filtre(setTypeSortie)(actif ? "" : (r.typeSortie ?? ""))}
                className={`px-3 py-2 rounded-xl border text-left text-xs transition-colors ${actif ? "border-primary-400 bg-primary-50 dark:bg-primary-900/30" : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                <span className="block font-medium text-slate-700 dark:text-slate-200">{r.typeSortie ? (TYPE_LABEL[r.typeSortie] ?? r.typeSortie) : "Non précisé"}</span>
                <span className="text-slate-500 dark:text-slate-400">{r.nombre} sortie(s) · {r.quantite} unité(s)</span>
              </button>
            );
          })}
        </div>
      )}

      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <input value={q} onChange={(e) => filtre(setQ)(e.target.value)} placeholder="Produit, référence, motif…" className={`${inputCls} w-full sm:w-56`} />
          <select value={typeSortie} onChange={(e) => filtre(setTypeSortie)(e.target.value)} className={inputCls}>
            <option value="">Tous les types</option>
            {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select value={pointDeVenteId} onChange={(e) => filtre(setPointDeVenteId)(e.target.value)} className={inputCls}>
            <option value="">Toutes les agences</option>
            {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Du <input type="date" value={debut} onChange={(e) => filtre(setDebut)(e.target.value)} className={inputCls} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            au <input type="date" value={fin} onChange={(e) => filtre(setFin)(e.target.value)} className={inputCls} />
          </label>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Produit</th>
                <th className="text-right px-4 py-3 font-medium">Qté</th>
                <th className="text-left px-4 py-3 font-medium">Agence</th>
                <th className="text-left px-4 py-3 font-medium">Source</th>
                <th className="text-left px-4 py-3 font-medium">Opérateur</th>
                <th className="text-right px-4 py-3 font-medium">Bon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && lignes.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-400 py-10">Chargement…</td></tr>
              )}
              {!loading && lignes.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-400 py-10">Aucune sortie sur ce filtre.</td></tr>
              )}
              {lignes.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDateTime(l.date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {l.typeSortie ? (TYPE_LABEL[l.typeSortie] ?? l.typeSortie) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{l.produit.nom}</span>
                    {l.produit.reference && <span className="block text-xs text-slate-400">{l.produit.reference}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-rose-600">−{l.quantite}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{l.pointDeVente ? l.pointDeVente.nom : "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {l.vente && <span className="block">Vente {l.vente.reference ?? `#${l.vente.id}`}</span>}
                    {l.souscriptionId && <span className="block">Souscription pack #{l.souscriptionId}</span>}
                    {l.bonSortie && (
                      <a href={`/api/magasinier/bons-sortie/${l.bonSortie.id}/pdf`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary-600 hover:underline">
                        <FileText size={11} /> Bon {l.bonSortie.reference ?? `#${l.bonSortie.id}`}
                      </a>
                    )}
                    {!l.vente && !l.souscriptionId && !l.bonSortie && <span title={l.reference}>{l.motif ?? l.reference}</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {l.operateur ? `${l.operateur.prenom} ${l.operateur.nom}` : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <a href={`/api/admin/stock/journal-sorties/${l.id}/pdf`} target="_blank" rel="noreferrer" title="Ouvrir le bon de sortie en PDF (impression depuis le lecteur)"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                        <Printer size={13} /> PDF / Imprimer
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} itemLabel="sorties" />}
      </Card>
    </div>
  );
}
