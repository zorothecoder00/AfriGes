"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, HandCoins, Scale, Plus, RefreshCw } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDateTime } from "@/lib/format";

/**
 * « Mes fonds collectés » : l'agent lit lui-même ce qu'il a collecté sur une période (3 mois maximum),
 * ce qu'il a déjà remis par bordereau, et prépare sa remise de fonds.
 */

const MAX_JOURS = 92;
const JOUR_MS = 86_400_000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(`${s}T00:00:00`);

const MODE_LABEL: Record<string, string> = { ESPECES: "Espèces", MOBILE_MONEY: "Mobile Money", VIREMENT: "Virement", CHEQUE: "Chèque", NON_PRECISE: "Non précisé" };
const SOURCE_BADGE: Record<string, string> = {
  SESSION: "bg-emerald-50 text-emerald-700", REMBOURSEMENT: "bg-blue-50 text-blue-700", VERSEMENT_PACK: "bg-violet-50 text-violet-700",
  VENTE: "bg-amber-50 text-amber-700", CARNET: "bg-slate-100 text-slate-600",
};
const SOURCE_COURT: Record<string, string> = { SESSION: "Session", REMBOURSEMENT: "Remboursement", VERSEMENT_PACK: "Pack", VENTE: "Vente", CARNET: "Carnet" };
const STATUT_BRF: Record<string, string> = { SOUMIS: "Soumis", ECART_SIGNALE: "Écart signalé", VALIDE: "Validé", CLOTURE: "Clôturé" };

interface Reponse {
  data: {
    periode: { debut: string; fin: string };
    totaux: { collecte: number; remis: number; reste: number; nombre: number };
    parSource: { source: string; libelle: string; montant: number; nombre: number }[];
    parMode: { mode: string; montant: number; nombre: number }[];
    parJour: { jour: string; montant: number; nombre: number }[];
    lignes: { id: string; source: string; date: string; montant: number; mode: string; reference: string | null; client: string | null; enAttenteConfirmation?: boolean }[];
    tronque: boolean;
    bordereaux: { id: number; reference: string; statut: string; date: string; montant: number }[];
  };
}

const inputCls = "px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300";

export default function FondsCollectesPage() {
  const aujourdhui = new Date();
  const [fin, setFin] = useState(iso(aujourdhui));
  const [debut, setDebut] = useState(iso(new Date(aujourdhui.getTime() - 29 * JOUR_MS)));
  const [visibles, setVisibles] = useState(20);

  const { data, loading, error, refetch } = useApi<Reponse>(`/api/agentTerrain/fonds-collectes?dateDebut=${debut}&dateFin=${fin}`);
  const d = data?.data;

  // Période bornée à 3 mois : ajuste l'autre borne si l'écart dépasse la limite.
  const changerDebut = (v: string) => {
    setDebut(v);
    if (v && (parse(fin).getTime() - parse(v).getTime()) / JOUR_MS > MAX_JOURS) setFin(iso(new Date(parse(v).getTime() + MAX_JOURS * JOUR_MS)));
    setVisibles(20);
  };
  const changerFin = (v: string) => {
    setFin(v);
    if (v && (parse(v).getTime() - parse(debut).getTime()) / JOUR_MS > MAX_JOURS) setDebut(iso(new Date(parse(v).getTime() - MAX_JOURS * JOUR_MS)));
    setVisibles(20);
  };
  const preset = (jours: number) => {
    const f = new Date();
    setFin(iso(f)); setDebut(iso(new Date(f.getTime() - (jours - 1) * JOUR_MS))); setVisibles(20);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-5 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/dashboard/user/agentsTerrain/bordereaux-remise" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1"><ArrowLeft className="w-3 h-3" /> Bordereaux de remise de fonds</Link>
            <h1 className="text-2xl font-bold text-slate-900">Mes fonds collectés</h1>
            <p className="text-sm text-slate-500 mt-0.5">Ce que vous avez collecté sur la période (3 mois maximum) et ce que vous avez déjà remis.</p>
          </div>
          <Link href="/dashboard/user/agentsTerrain/bordereaux-remise?nouveau=1" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold"><Plus className="w-4 h-4" /> Remettre des fonds</Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-2 flex-wrap">
          {[{ l: "7 jours", j: 7 }, { l: "30 jours", j: 30 }, { l: "3 mois", j: MAX_JOURS }].map((p) => (
            <button key={p.j} onClick={() => preset(p.j)} className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">{p.l}</button>
          ))}
          <span className="text-xs text-slate-400 ml-2">Du</span>
          <input type="date" value={debut} max={fin} onChange={(e) => changerDebut(e.target.value)} className={inputCls} />
          <span className="text-xs text-slate-400">au</span>
          <input type="date" value={fin} min={debut} max={iso(new Date())} onChange={(e) => changerFin(e.target.value)} className={inputCls} />
          <button onClick={refetch} className="ml-auto p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Actualiser"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {error && <p className="text-sm text-red-600">{typeof error === "string" ? error : "Impossible de charger la période."}</p>}
        {loading && !d && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}

        {d && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-emerald-100 rounded-2xl p-4"><p className="text-xs text-slate-500 flex items-center gap-1.5"><HandCoins className="w-4 h-4 text-emerald-600" /> Collecté</p><p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(d.totaux.collecte)}</p><p className="text-xs text-slate-400">{d.totaux.nombre} encaissement(s)</p></div>
              <div className="bg-white border border-blue-100 rounded-2xl p-4"><p className="text-xs text-slate-500 flex items-center gap-1.5"><Banknote className="w-4 h-4 text-blue-600" /> Remis (bordereaux)</p><p className="text-2xl font-bold text-blue-700 mt-1">{formatCurrency(d.totaux.remis)}</p><p className="text-xs text-slate-400">{d.bordereaux.length} bordereau(x)</p></div>
              <div className="bg-white border border-amber-100 rounded-2xl p-4"><p className="text-xs text-slate-500 flex items-center gap-1.5"><Scale className="w-4 h-4 text-amber-600" /> Reste à remettre (indicatif)</p><p className={`text-2xl font-bold mt-1 ${d.totaux.reste > 0 ? "text-amber-700" : "text-slate-700"}`}>{formatCurrency(d.totaux.reste)}</p><p className="text-xs text-slate-400">Collecté − remis sur la période</p></div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <h2 className="text-sm font-semibold text-slate-700 mb-2">Par source</h2>
                {d.parSource.length === 0 ? <p className="text-sm text-slate-400">Aucun encaissement.</p> : (
                  <ul className="divide-y divide-slate-100">{d.parSource.map((s) => (
                    <li key={s.source} className="flex items-center justify-between py-2 text-sm"><span className="text-slate-600">{s.libelle} <span className="text-slate-400">· {s.nombre}</span></span><span className="font-semibold text-slate-800">{formatCurrency(s.montant)}</span></li>
                  ))}</ul>
                )}
                <h2 className="text-sm font-semibold text-slate-700 mt-4 mb-2">Par mode de paiement</h2>
                <ul className="divide-y divide-slate-100">{d.parMode.map((m) => (
                  <li key={m.mode} className="flex items-center justify-between py-2 text-sm"><span className="text-slate-600">{MODE_LABEL[m.mode] ?? m.mode} <span className="text-slate-400">· {m.nombre}</span></span><span className="font-semibold text-slate-800">{formatCurrency(m.montant)}</span></li>
                ))}</ul>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <h2 className="text-sm font-semibold text-slate-700 mb-2">Par jour</h2>
                {d.parJour.length === 0 ? <p className="text-sm text-slate-400">Aucun encaissement.</p> : (
                  <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">{d.parJour.map((j) => (
                    <li key={j.jour} className="flex items-center justify-between py-2 text-sm"><span className="text-slate-600">{parse(j.jour).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })} <span className="text-slate-400">· {j.nombre}</span></span><span className="font-semibold text-slate-800">{formatCurrency(j.montant)}</span></li>
                  ))}</ul>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <h2 className="text-sm font-semibold text-slate-700 px-4 pt-4 pb-2">Détail des encaissements</h2>
              {d.lignes.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucun encaissement sur cette période.</p>}
              <ul className="divide-y divide-slate-100">
                {d.lignes.slice(0, visibles).map((l) => (
                  <li key={l.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${SOURCE_BADGE[l.source] ?? "bg-slate-100 text-slate-600"}`}>{SOURCE_COURT[l.source] ?? l.source}</span>
                        <span className="text-sm text-slate-700 truncate">{l.client ?? l.reference ?? "—"}</span>
                        {l.enAttenteConfirmation && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Confirmation caissier en attente</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(l.date)} · {MODE_LABEL[l.mode] ?? l.mode}{l.reference && l.client ? ` · ${l.reference}` : ""}</p>
                    </div>
                    <span className="font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(l.montant)}</span>
                  </li>
                ))}
              </ul>
              {d.lignes.length > visibles && (
                <button onClick={() => setVisibles((v) => v + 30)} className="w-full py-3 text-sm text-emerald-700 hover:bg-emerald-50 border-t border-slate-100">Afficher plus ({d.lignes.length - visibles} restants)</button>
              )}
              {d.tronque && <p className="text-xs text-amber-700 px-4 py-2 border-t border-slate-100">Affichage limité aux 500 encaissements les plus récents : réduisez la période pour tout voir.</p>}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Mes bordereaux de remise de fonds sur la période</h2>
              {d.bordereaux.length === 0 ? <p className="text-sm text-slate-400">Aucun bordereau sur cette période.</p> : (
                <ul className="divide-y divide-slate-100">{d.bordereaux.map((b) => (
                  <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/dashboard/user/agentsTerrain/bordereaux-remise?detail=${b.id}`} className="text-slate-700 hover:underline"><span className="font-mono font-semibold">{b.reference}</span> <span className="text-slate-400">· {formatDateTime(b.date)} · {STATUT_BRF[b.statut] ?? b.statut}</span></Link>
                    <span className="font-semibold text-slate-800">{formatCurrency(b.montant)}</span>
                  </li>
                ))}</ul>
              )}
            </div>
            <p className="text-xs text-slate-400">Les montants proviennent de vos sessions de collecte et des encaissements enregistrés à votre nom, sans double compte. Le « reste à remettre » est indicatif : il compare les fonds collectés sur la période aux bordereaux créés sur la même période.</p>
          </>
        )}
      </div>
    </div>
  );
}
