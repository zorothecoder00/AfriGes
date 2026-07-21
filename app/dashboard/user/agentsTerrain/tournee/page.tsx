"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import {
  Navigation, ArrowLeft, Phone, MapPin, Wallet, AlertTriangle, Clock, CheckCircle2,
} from "lucide-react";

type Priorite = "URGENTE" | "HAUTE" | "NORMALE";
interface LigneTournee {
  creditId: number; reference: string; clientId: number; clientNom: string;
  telephone: string; quartier: string; formule: string;
  miseDuJour: number; montantRetard: number; montantACollecter: number;
  echeance: string; retardJours: number; priorite: Priorite;
}
interface TourneeResp {
  data: LigneTournee[];
  meta: { total: number; totalACollecter: number; urgentes: number };
}

const fmt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));

const BADGE: Record<Priorite, string> = {
  URGENTE: "bg-red-100 text-red-700",
  HAUTE: "bg-amber-100 text-amber-700",
  NORMALE: "bg-blue-100 text-blue-700",
};

export default function TourneePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { data, loading } = useApi<TourneeResp>(
    `/api/popc/tournee?date=${date}`,
    undefined,
    { refreshInterval: 120000 },
  );
  const lignes = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/dashboard/user/agentsTerrain"
              className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-1">
              <ArrowLeft className="w-4 h-4" /> Tableau de bord
            </Link>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Navigation className="w-6 h-6 text-indigo-600" /> Ma tournée du jour
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Clients à visiter, triés par priorité (§10)</p>
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white" />
        </div>

        {/* Résumé */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs"><MapPin className="w-4 h-4" /> Clients à visiter</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{fmt(meta?.total ?? 0)}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs"><AlertTriangle className="w-4 h-4" /> Urgentes</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{fmt(meta?.urgentes ?? 0)}</div>
          </div>
          <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 shadow-sm">
            <div className="flex items-center gap-1.5 text-indigo-500 text-xs"><Wallet className="w-4 h-4" /> À collecter</div>
            <div className="text-2xl font-bold text-indigo-700 mt-1">{fmt(meta?.totalACollecter ?? 0)} F</div>
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <p className="text-sm text-slate-400 px-1">Chargement…</p>
        ) : lignes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
            <p className="text-slate-700 font-medium">Aucune visite prévue ce jour</p>
            <p className="text-sm text-slate-400 mt-1">Aucune échéance du jour ni en retard dans votre portefeuille.</p>
          </div>
        ) : (
          <>
            {/* Vue desktop : tableau */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-left px-4 py-3 font-medium">Quartier</th>
                    <th className="text-left px-4 py-3 font-medium">Crédit</th>
                    <th className="text-right px-4 py-3 font-medium">Mise du jour</th>
                    <th className="text-right px-4 py-3 font-medium">À collecter</th>
                    <th className="text-left px-4 py-3 font-medium">Échéance</th>
                    <th className="text-center px-4 py-3 font-medium">Priorité</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.creditId} className="border-t border-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{l.clientNom}</p>
                        <a href={`tel:${l.telephone}`} className="text-xs text-indigo-500 flex items-center gap-1"><Phone className="w-3 h-3" />{l.telephone}</a>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{l.quartier}</td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{l.reference}</p>
                        <p className="text-xs text-slate-400">{l.formule}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{fmt(l.miseDuJour)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {fmt(l.montantACollecter)}
                        {l.montantRetard > 0 && <span className="block text-xs text-red-500">dont {fmt(l.montantRetard)} retard</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-600">{new Date(l.echeance).toLocaleDateString("fr-FR")}</span>
                        {l.retardJours > 0 && <span className="block text-xs text-red-500 flex items-center gap-1"><Clock className="w-3 h-3" />{l.retardJours} j de retard</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${BADGE[l.priorite]}`}>{l.priorite}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vue mobile : cartes */}
            <div className="md:hidden space-y-3">
              {lignes.map((l) => (
                <div key={l.creditId} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{l.clientNom}</p>
                      <p className="text-xs text-slate-400">{l.quartier} · {l.reference} · {l.formule}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${BADGE[l.priorite]}`}>{l.priorite}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <a href={`tel:${l.telephone}`} className="text-sm text-indigo-600 flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{l.telephone}</a>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">{fmt(l.montantACollecter)} F</p>
                      {l.retardJours > 0 && <p className="text-xs text-red-500">{l.retardJours} j de retard</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="text-xs text-slate-400">
          Tournée générée automatiquement depuis vos crédits actifs : échéance du jour + retards, priorité selon l&apos;ancienneté et le montant. Aucune ressaisie.
        </p>
      </div>
    </div>
  );
}
