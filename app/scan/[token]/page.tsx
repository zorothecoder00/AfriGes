"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Navigation, Phone, MapPin, Wallet, AlertTriangle, Clock, CheckCircle2,
  Target, BookOpen, Loader2, RefreshCw,
} from "lucide-react";

type Priorite = "URGENTE" | "HAUTE" | "NORMALE";
interface LigneTournee {
  creditId: number; reference: string; clientNom: string; telephone: string;
  quartier: string; formule: string; miseDuJour: number; montantRetard: number;
  montantACollecter: number; echeance: string; retardJours: number; priorite: Priorite;
}
interface ScanData {
  agent: { nom: string; prenom: string };
  date: string;
  objectifsJour: { quinzaine: number; trentaine: number; carnets: number; disponible: boolean };
  clients: LigneTournee[];
}

const fmt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));
const BADGE: Record<Priorite, string> = {
  URGENTE: "bg-red-100 text-red-700",
  HAUTE: "bg-amber-100 text-amber-700",
  NORMALE: "bg-blue-100 text-blue-700",
};

export default function ScanTourneePage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const charger = () => {
    fetch(`/api/agent-scan/${params.token}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Erreur");
        setData(j.data as ScanData); setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  };
  useEffect(charger, [params.token]);

  const totalACollecter = data?.clients.reduce((s, c) => s + c.montantACollecter, 0) ?? 0;
  const urgentes = data?.clients.filter((c) => c.priorite === "URGENTE").length ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">Ma journée</h1>
              {data && <p className="text-xs text-slate-500">{data.agent.prenom} {data.agent.nom}</p>}
            </div>
          </div>
          <button onClick={() => { setLoading(true); charger(); }} className="p-2 text-slate-400 hover:text-slate-600" title="Rafraîchir">
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-2" />
            <p className="text-slate-700 font-medium">Lien invalide ou expiré</p>
            <p className="text-sm text-slate-400 mt-1">Demandez un nouveau QR à votre responsable.</p>
          </div>
        ) : data ? (
          <>
            <p className="text-xs text-slate-400 -mt-2">
              {new Date(data.date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}
            </p>

            {/* Objectifs du jour */}
            <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-4 text-white">
              <p className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                <Target className="w-4 h-4" /> Mes objectifs du jour
              </p>
              {data.objectifsJour.disponible ? (
                <div className="grid grid-cols-3 gap-3">
                  <div><p className="text-2xl font-bold">{fmt(data.objectifsJour.quinzaine)}</p><p className="text-[11px] text-indigo-100">Quinzaine</p></div>
                  <div><p className="text-2xl font-bold">{fmt(data.objectifsJour.trentaine)}</p><p className="text-[11px] text-indigo-100">Trentaine</p></div>
                  <div><p className="text-2xl font-bold">{fmt(data.objectifsJour.carnets)}</p><p className="text-[11px] text-indigo-100">Carnets</p></div>
                </div>
              ) : (
                <p className="text-xs text-indigo-100">Objectifs non encore définis par la Direction pour ce mois.</p>
              )}
            </section>

            {/* Résumé collecte */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
                <MapPin className="w-4 h-4 text-slate-400 mx-auto" />
                <p className="text-xl font-bold text-slate-800 mt-1">{data.clients.length}</p>
                <p className="text-[10px] text-slate-400">à visiter</p>
              </div>
              <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
                <AlertTriangle className="w-4 h-4 text-red-500 mx-auto" />
                <p className="text-xl font-bold text-red-600 mt-1">{urgentes}</p>
                <p className="text-[10px] text-slate-400">urgentes</p>
              </div>
              <div className="bg-indigo-50 rounded-2xl p-3 border border-indigo-100 text-center">
                <Wallet className="w-4 h-4 text-indigo-500 mx-auto" />
                <p className="text-base font-bold text-indigo-700 mt-1">{fmt(totalACollecter)}</p>
                <p className="text-[10px] text-indigo-400">à collecter</p>
              </div>
            </div>

            {/* Clients à visiter */}
            <section>
              <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-slate-400" /> Clients à visiter (cotisations du jour + retards)
              </p>
              {data.clients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-2xl border border-slate-100">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                  <p className="text-slate-700 font-medium">Aucune visite prévue</p>
                  <p className="text-xs text-slate-400 mt-1">Aucune échéance ni retard aujourd&apos;hui.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.clients.map((c) => (
                    <div key={c.creditId} className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{c.clientNom}</p>
                          <p className="text-xs text-slate-400">{c.quartier} · {c.formule}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${BADGE[c.priorite]}`}>{c.priorite}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2.5">
                        <a href={`tel:${c.telephone}`} className="inline-flex items-center gap-1.5 text-sm text-indigo-600 font-medium">
                          <Phone className="w-4 h-4" /> {c.telephone}
                        </a>
                        <div className="text-right">
                          <p className="font-bold text-slate-800">{fmt(c.montantACollecter)} F</p>
                          {c.retardJours > 0 && (
                            <p className="text-[11px] text-red-500 flex items-center gap-1 justify-end">
                              <Clock className="w-3 h-3" /> {c.retardJours} j de retard
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="text-[11px] text-slate-400 text-center pt-2">
              Généré automatiquement · données de la journée. Ce lien est personnel — ne le partagez pas.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
