"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import {
  Target, Users, UserCheck, UserPlus, MapPin, CreditCard,
  BookOpen, Wallet, TrendingUp, ArrowLeft, AlertTriangle,
} from "lucide-react";

interface CommercialData {
  clientsAffectes: number; clientsVisites: number; clientsRestants: number;
  nouveauxClientsRecrutes: number; creditsLivres: number;
  seiziemesCollectes: number; trentiemesCollectes: number; carnetsVendus: number;
  montantCollecte: number; objectifAgent: number; tauxRealisation: number;
  objectifsGeneres: boolean;
}

const fmt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function MesObjectifsPage() {
  const now = new Date();
  const [annee, setAnnee] = useState(now.getFullYear());
  const [mois, setMois] = useState(now.getMonth() + 1);
  const { data, loading } = useApi<{ data: CommercialData }>(
    `/api/popc/commercial?annee=${annee}&mois=${mois}`,
    undefined,
    { refreshInterval: 60000 },
  );
  const d = data?.data;
  const taux = d?.tauxRealisation ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/dashboard/user/agentsTerrain"
              className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-1">
              <ArrowLeft className="w-4 h-4" /> Tableau de bord
            </Link>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Target className="w-6 h-6 text-indigo-600" /> Mes objectifs
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Mes performances personnelles — {MOIS[mois - 1]} {annee}</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={mois} onChange={(e) => setMois(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
              {MOIS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" value={annee} onChange={(e) => setAnnee(Number(e.target.value))}
              className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm" />
          </div>
        </div>

        {!loading && d && !d.objectifsGeneres && (
          <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 text-amber-700 rounded-xl text-sm">
            <AlertTriangle className="w-4 h-4" /> Aucun objectif défini pour ce mois par la Direction — le taux de réalisation reste indicatif.
          </div>
        )}

        {/* Taux de réalisation */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-5 text-white">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-indigo-100 text-sm flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Taux de réalisation</p>
              <p className="text-3xl font-bold mt-1">{taux}%</p>
            </div>
            <p className="text-indigo-100 text-sm">
              {d ? fmt(d.montantCollecte) : "—"} / {d ? fmt(d.objectifAgent) : "—"} FCFA collectés
            </p>
          </div>
          <div className="mt-3 h-2.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min(100, taux)}%` }} />
          </div>
        </div>

        {/* Cartes indicateurs (§9) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card icon={<Users className="w-4 h-4" />} label="Clients affectés" value={fmt(d?.clientsAffectes ?? 0)} />
          <Card icon={<UserCheck className="w-4 h-4" />} label="Clients visités" value={fmt(d?.clientsVisites ?? 0)} />
          <Card icon={<MapPin className="w-4 h-4" />} label="Restant à visiter" value={fmt(d?.clientsRestants ?? 0)} />
          <Card icon={<UserPlus className="w-4 h-4" />} label="Nouveaux clients recrutés" value={fmt(d?.nouveauxClientsRecrutes ?? 0)} />
          <Card icon={<CreditCard className="w-4 h-4" />} label="Crédits livrés" value={fmt(d?.creditsLivres ?? 0)} />
          <Card icon={<BookOpen className="w-4 h-4" />} label="16èmes collectés" value={fmt(d?.seiziemesCollectes ?? 0)} />
          <Card icon={<BookOpen className="w-4 h-4" />} label="31èmes collectés" value={fmt(d?.trentiemesCollectes ?? 0)} />
          <Card icon={<BookOpen className="w-4 h-4" />} label="Carnets vendus" value={fmt(d?.carnetsVendus ?? 0)} />
          <Card icon={<Wallet className="w-4 h-4" />} label="Montant collecté" value={`${fmt(d?.montantCollecte ?? 0)} F`} highlight />
        </div>

        <p className="text-xs text-slate-400">
          Données personnelles alimentées automatiquement : affectations, visites, crédits livrés, remboursements confirmés et carnets vendus. Vous ne voyez que vos propres données.
        </p>
      </div>
    </div>
  );
}

function Card({ icon, label, value, highlight }: { icon: ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 border shadow-sm ${highlight ? "bg-indigo-50 border-indigo-100" : "bg-white border-slate-100"}`}>
      <div className="flex items-center gap-1.5 text-slate-400 text-xs">{icon}{label}</div>
      <div className={`text-xl font-bold mt-1 ${highlight ? "text-indigo-700" : "text-slate-800"}`}>{value}</div>
    </div>
  );
}
