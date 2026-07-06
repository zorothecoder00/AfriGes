"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Wallet, ArrowLeft, Loader2, TrendingUp, TrendingDown, ShoppingCart,
  Activity, Clock, MapPin, Phone, User, Hash,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import ClienteleTabBar from "@/components/ClienteleTabBar";

interface CompteDetail {
  id: number; numeroCompte: string; ribComplet: string; cleRib: string;
  codeAgence: string; codeGuichet: string; statut: string; motifBlocage: string | null;
  solde: string | number; totalDepose: string | number; totalRetire: string | number; totalUtilise: string | number;
  nbMouvements: number; dateOuverture: string; derniereOperationAt: string | null;
  client: {
    id: number; nom: string; prenom: string; telephone: string; telephoneSecondaire: string | null;
    codeClient: string | null; quartier: string | null; ville: string | null; commune: string | null;
    adresse: string | null; photoUrl: string | null; etat: string; segment: string;
    agentTerrain: { nom: string; prenom: string } | null;
    pointDeVente: { nom: string; code: string } | null;
  };
  agentCreateur: { nom: string; prenom: string } | null;
}

const STATUT_STYLE: Record<string, string> = {
  ACTIF: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SUSPENDU: "bg-amber-100 text-amber-700 border-amber-200",
  CLOTURE: "bg-gray-100 text-gray-600 border-gray-200",
  DECEDE: "bg-slate-200 text-slate-700 border-slate-300",
  BLACKLIST: "bg-red-100 text-red-700 border-red-200",
  FRAUDULEUX: "bg-rose-100 text-rose-700 border-rose-200",
};
const STATUT_LABEL: Record<string, string> = {
  ACTIF: "Actif", SUSPENDU: "Suspendu", CLOTURE: "Clôturé",
  DECEDE: "Décédé", BLACKLIST: "Blacklisté", FRAUDULEUX: "Frauduleux",
};
const N = (v: string | number) => Number(v ?? 0);
const initials = (p?: string, n?: string) => `${p?.[0] ?? ""}${n?.[0] ?? ""}`.toUpperCase();

export default function CompteCourantDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: res, loading } = useApi<{ data: CompteDetail }>(`/api/comptes-courants/${params.id}`);
  const c = res?.data;

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Link href="/dashboard/admin/comptes-courants" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour aux comptes courants
        </Link>

        {loading && !c ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement…
          </div>
        ) : !c ? (
          <p className="text-center py-20 text-gray-400">Compte introuvable.</p>
        ) : (
          <>
            {/* En-tête compte */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center overflow-hidden ring-2 ring-white/30">
                    {c.client.photoUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.client.photoUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="font-bold text-lg">{initials(c.client.prenom, c.client.nom)}</span>}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{c.client.prenom} {c.client.nom}</h2>
                    <p className="font-mono text-sm text-white/85">{c.numeroCompte}</p>
                    <p className="font-mono text-[11px] text-white/70">{c.ribComplet}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-3 py-1 rounded-full border font-medium bg-white/90 ${STATUT_STYLE[c.statut] ?? ""}`}>
                    {STATUT_LABEL[c.statut] ?? c.statut}
                  </span>
                  <p className="text-2xl font-extrabold mt-2">{formatCurrency(N(c.solde))}</p>
                  <p className="text-[11px] text-white/80">Solde actuel</p>
                </div>
              </div>
              {c.motifBlocage && (
                <div className="px-6 py-2 bg-red-50 text-red-700 text-xs border-t border-red-100">Motif de blocage : {c.motifBlocage}</div>
              )}
            </div>

            {/* Totaux / KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Total déposé"  value={formatCurrency(N(c.totalDepose))}  icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50" />
              <Kpi label="Total utilisé" value={formatCurrency(N(c.totalUtilise))} icon={<ShoppingCart className="w-5 h-5 text-blue-600" />}  bg="bg-blue-50" />
              <Kpi label="Total retiré"  value={formatCurrency(N(c.totalRetire))}  icon={<TrendingDown className="w-5 h-5 text-orange-600" />} bg="bg-orange-50" />
              <Kpi label="Mouvements"    value={String(c.nbMouvements)}            icon={<Activity className="w-5 h-5 text-violet-600" />}    bg="bg-violet-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Infos client */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /> Informations client</h3>
                <div className="space-y-2.5 text-sm">
                  <Row icon={<Hash className="w-4 h-4" />} label="Code client" value={c.client.codeClient ?? "—"} />
                  <Row icon={<Phone className="w-4 h-4" />} label="Téléphone" value={c.client.telephone + (c.client.telephoneSecondaire ? ` · ${c.client.telephoneSecondaire}` : "")} />
                  <Row icon={<MapPin className="w-4 h-4" />} label="Communauté" value={c.client.commune ?? "—"} />
                  <Row icon={<MapPin className="w-4 h-4" />} label="Zone" value={c.client.ville ?? "—"} />
                  <Row icon={<MapPin className="w-4 h-4" />} label="Quartier" value={c.client.quartier ?? "—"} />
                  <Row icon={<User className="w-4 h-4" />} label="Agent" value={c.client.agentTerrain ? `${c.client.agentTerrain.prenom} ${c.client.agentTerrain.nom}` : "—"} />
                </div>
              </div>

              {/* Infos compte */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Wallet className="w-4 h-4 text-gray-400" /> Informations compte</h3>
                <div className="space-y-2.5 text-sm">
                  <Row icon={<Hash className="w-4 h-4" />} label="N° de compte" value={c.numeroCompte} mono />
                  <Row icon={<Hash className="w-4 h-4" />} label="RIB complet" value={c.ribComplet} mono />
                  <Row icon={<MapPin className="w-4 h-4" />} label="Agence / Guichet" value={`${c.codeAgence} · ${c.codeGuichet}`} />
                  <Row icon={<Clock className="w-4 h-4" />} label="Date d'ouverture" value={formatDate(c.dateOuverture)} />
                  <Row icon={<Clock className="w-4 h-4" />} label="Dernière opération" value={c.derniereOperationAt ? formatDate(c.derniereOperationAt) : "—"} />
                  <Row icon={<User className="w-4 h-4" />} label="Ouvert par" value={c.agentCreateur ? `${c.agentCreateur.prenom} ${c.agentCreateur.nom}` : "—"} />
                </div>
              </div>
            </div>

            {/* Historique — arrive au Lot 2 */}
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
              L&apos;historique des mouvements, les dépôts et les retraits arrivent dans les prochains lots du module.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, bg }: { label: string; value: string; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`${bg} p-2.5 rounded-xl shrink-0`}>{icon}</div>
      <div><p className="text-xs text-gray-500">{label}</p><p className="font-bold text-gray-900 text-lg">{value}</p></div>
    </div>
  );
}
function Row({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-gray-500"><span className="text-gray-300">{icon}</span>{label}</span>
      <span className={`font-medium text-gray-800 text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
