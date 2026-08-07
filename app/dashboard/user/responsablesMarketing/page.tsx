"use client";

import { useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Menu, Plus, Loader2, Megaphone, Users, Wallet, LayoutDashboard, MessageCircle, Image as ImageIcon, Zap,
  Send, CheckCircle2, XCircle, Play, Pause, RotateCcw, Flag, Archive, Sparkles, Tag, Gift, Users2, MapPin, Rocket, Star, BarChart3,
  Building2, Briefcase, CalendarDays, Share2,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import AccountMenuButton from "@/components/AccountMenuButton";
import CongesNavButton from "@/components/CongesNavButton";
import MessagesLink from "@/components/MessagesLink";
import UserPdvBadge from "@/components/UserPdvBadge";
import AfriSimeLogo from "@/components/AfriSimeLogo";
import KpiCard from "@/components/ui/KpiCard";
import NouvelleCampagneModal from "@/components/marketing/NouvelleCampagneModal";
import NouvelleAudienceModal from "@/components/marketing/NouvelleAudienceModal";
import EnvoyerCampagneModal from "@/components/marketing/EnvoyerCampagneModal";
import ModeleMessageForm from "@/components/marketing/ModeleMessageForm";
import BibliothequeContenu from "@/components/marketing/BibliothequeContenu";
import CalendrierEditorial from "@/components/marketing/CalendrierEditorial";
import ListeAutomatisation from "@/components/marketing/ListeAutomatisation";
import MesTachesMarketing from "@/components/marketing/MesTachesMarketing";
import PromotionsMarketing from "@/components/marketing/PromotionsMarketing";
import CouponsMarketing from "@/components/marketing/CouponsMarketing";
import RecompensesFidelite from "@/components/marketing/RecompensesFidelite";
import ChallengesMarketing from "@/components/marketing/ChallengesMarketing";
import BadgesMarketing from "@/components/marketing/BadgesMarketing";
import ParrainageMarketing from "@/components/marketing/ParrainageMarketing";
import OperationsTerrainMarketing from "@/components/marketing/OperationsTerrainMarketing";
import EvenementsMarketing from "@/components/marketing/EvenementsMarketing";
import QrCodesMarketing from "@/components/marketing/QrCodesMarketing";
import LandingPagesMarketing from "@/components/marketing/LandingPagesMarketing";
import FormulairesMarketing from "@/components/marketing/FormulairesMarketing";
import PartenairesMarketing from "@/components/marketing/PartenairesMarketing";
import AnalyticsMarketing from "@/components/marketing/AnalyticsMarketing";
import TestsABMarketing from "@/components/marketing/TestsABMarketing";
import ZonesChalandiseMarketing from "@/components/marketing/ZonesChalandiseMarketing";
import DepensesMarketing from "@/components/marketing/DepensesMarketing";
import BudgetsMarketing from "@/components/marketing/BudgetsMarketing";
import AnimationAgencesMarketing from "@/components/marketing/AnimationAgencesMarketing";
import MarketingB2BMarketing from "@/components/marketing/MarketingB2BMarketing";

type TabKey =
  | "synthese" | "campagnes" | "audiences" | "communication" | "contenu" | "promotions" | "fidelisation" | "parrainage"
  | "animationAgences" | "b2b" | "evenementiel" | "terrain" | "socialMedia" | "acquisition" | "automatisation"
  | "analytics" | "budgets" | "partenaires";

interface StatsResponse {
  data: {
    totaux: {
      budgetPrevu: number; depenses: number; campagnesActives: number; campagnesTerminees: number;
      nouveauxClients: number; clientsReactives: number; caAttribue: number; margeAttribuee: number;
      cac: number | null; roi: number | null;
    };
    topCampagnes: { id: number; code: string; nom: string; caAttribue: number }[];
  };
}
interface CampagneItem {
  id: number; code: string; nom: string; statut: string; dateDebut: string; dateFin: string;
  typeCampagne: { libelle: string };
  budget: { id: number; montantPrevu: number | string; statut: string } | null;
  agences: { pointDeVente: { id: number; nom: string } }[];
}
interface AudienceItem {
  id: number; nom: string; type: string; tailleCalculee: number | null; _count: { campagnes: number };
}

const STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon", PLANIFIEE: "Planifiée", APPROUVEE: "Approuvée",
  ACTIVE: "Active", PAUSE: "En pause", TERMINEE: "Terminée", ARCHIVEE: "Archivée",
};
const STATUT_STYLE: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-600", PLANIFIEE: "bg-blue-100 text-blue-700",
  APPROUVEE: "bg-indigo-100 text-indigo-700", ACTIVE: "bg-emerald-100 text-emerald-700",
  PAUSE: "bg-amber-100 text-amber-700", TERMINEE: "bg-slate-200 text-slate-700",
  ARCHIVEE: "bg-slate-100 text-slate-400",
};
const ACTIONS_PAR_STATUT: Record<string, { action: string; label: string; icon: typeof Send; style: string }[]> = {
  BROUILLON: [{ action: "SOUMETTRE", label: "Soumettre", icon: Send, style: "bg-blue-600 hover:bg-blue-700" }],
  PLANIFIEE: [
    { action: "APPROUVER", label: "Approuver", icon: CheckCircle2, style: "bg-indigo-600 hover:bg-indigo-700" },
    { action: "REJETER", label: "Renvoyer en brouillon", icon: XCircle, style: "bg-red-500 hover:bg-red-600" },
  ],
  APPROUVEE: [{ action: "ACTIVER", label: "Activer", icon: Play, style: "bg-emerald-600 hover:bg-emerald-700" }],
  ACTIVE: [
    { action: "METTRE_EN_PAUSE", label: "Pause", icon: Pause, style: "bg-amber-500 hover:bg-amber-600" },
    { action: "TERMINER", label: "Terminer", icon: Flag, style: "bg-slate-600 hover:bg-slate-700" },
  ],
  PAUSE: [
    { action: "REPRENDRE", label: "Reprendre", icon: RotateCcw, style: "bg-emerald-600 hover:bg-emerald-700" },
    { action: "TERMINER", label: "Terminer", icon: Flag, style: "bg-slate-600 hover:bg-slate-700" },
  ],
  TERMINEE: [{ action: "ARCHIVER", label: "Archiver", icon: Archive, style: "bg-slate-500 hover:bg-slate-600" }],
  ARCHIVEE: [],
};

export default function ResponsableMarketingPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("synthese");

  const tabs: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
    { key: "synthese", label: "Synthèse", icon: LayoutDashboard },
    { key: "campagnes", label: "Campagnes", icon: Megaphone },
    { key: "audiences", label: "Audiences", icon: Users },
    { key: "communication", label: "Communication", icon: MessageCircle },
    { key: "contenu", label: "Bibliothèque", icon: ImageIcon },
    { key: "promotions", label: "Promotions", icon: Tag },
    { key: "fidelisation", label: "Fidélisation", icon: Gift },
    { key: "parrainage", label: "Parrainage", icon: Users2 },
    { key: "animationAgences", label: "Animation agences", icon: Building2 },
    { key: "b2b", label: "Marketing B2B", icon: Briefcase },
    { key: "evenementiel", label: "Événementiel", icon: CalendarDays },
    { key: "terrain", label: "Marketing terrain", icon: MapPin },
    { key: "socialMedia", label: "Social Media", icon: Share2 },
    { key: "acquisition", label: "Marketing Digital", icon: Rocket },
    { key: "automatisation", label: "Automatisation", icon: Zap },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "budgets", label: "Budget", icon: Wallet },
    { key: "partenaires", label: "Partenaires", icon: Star },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-fuchsia-800 to-fuchsia-900 text-white transform transition-transform lg:translate-x-0 lg:static ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-white p-1 flex items-center justify-center overflow-hidden shadow-sm">
            <AfriSimeLogo className="w-full h-full object-contain" />
          </div>
          <p className="text-fuchsia-200 text-xs mt-2 font-medium">Espace Marketing</p>
        </div>
        <nav className="p-3 space-y-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === t.key ? "bg-white/15 text-white shadow-inner" : "text-fuchsia-100/80 hover:bg-white/10 hover:text-white"
              }`}>
              <t.icon size={17} /> {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700">
                <Menu size={22} />
              </button>
              <div className="hidden lg:block" />
              <div className="flex items-center gap-3">
                <MessagesLink />
                <CongesNavButton />
                <UserPdvBadge />
                <NotificationBell href="/dashboard/user/notifications" />
                <AccountMenuButton settingsHref="/dashboard/user/parametres" catalogueHref="/dashboard/user/catalogue" inline />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {activeTab === "synthese" && <Synthese />}
          {activeTab === "campagnes" && <Campagnes />}
          {activeTab === "audiences" && <Audiences />}
          {activeTab === "communication" && <Communication />}
          {activeTab === "contenu" && <BibliothequeContenu />}
          {activeTab === "promotions" && <Promotions />}
          {activeTab === "fidelisation" && <Fidelisation />}
          {activeTab === "parrainage" && <ParrainageMarketing />}
          {activeTab === "animationAgences" && <AnimationAgencesMarketing />}
          {activeTab === "b2b" && <MarketingB2BMarketing />}
          {activeTab === "evenementiel" && <EvenementsMarketing />}
          {activeTab === "terrain" && <Terrain />}
          {activeTab === "socialMedia" && <CalendrierEditorial />}
          {activeTab === "acquisition" && <Acquisition />}
          {activeTab === "automatisation" && <Automatisation />}
          {activeTab === "analytics" && <Analytics />}
          {activeTab === "budgets" && <Budgets />}
          {activeTab === "partenaires" && <PartenairesMarketing />}
        </main>
      </div>
    </div>
  );
}

const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(0)} %`);

function Synthese() {
  const { data: res, loading } = useApi<StatsResponse>("/api/admin/marketing/stats");
  const s = res?.data.totaux;
  if (loading && !res) return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!s) return null;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Tableau de bord — Marketing</h2>
        <p className="text-slate-500 text-sm mt-0.5">Ce qu&apos;on a fait, et ce que ça a rapporté — ce mois.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Budget prévu" value={s.budgetPrevu} format={formatCurrency} icon={<Wallet size={18} />} accent="primary" />
        <KpiCard label="Campagnes actives" value={s.campagnesActives} icon={<Megaphone size={18} />} accent="brand" />
        <KpiCard label="CA attribué" value={s.caAttribue} format={formatCurrency} icon={<Megaphone size={18} />} accent="success" />
        <KpiCard label="ROI" value={s.roi ?? 0} format={(n) => pct(s.roi === null ? null : n)} icon={<Sparkles size={18} />} accent={s.roi !== null && s.roi >= 0 ? "success" : "error"} />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Top campagnes</h3>
        {(res?.data.topCampagnes ?? []).length === 0 ? (
          <p className="text-slate-400 text-sm">Aucune campagne pour l&apos;instant</p>
        ) : res!.data.topCampagnes.map((c) => (
          <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
            <span className="text-sm font-medium text-slate-700">{c.nom} <span className="text-xs text-slate-400">({c.code})</span></span>
            <span className="text-sm font-semibold text-slate-800">{formatCurrency(c.caAttribue)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Campagnes() {
  const { data: res, loading, refetch } = useApi<{ data: CampagneItem[] }>("/api/admin/marketing/campagnes");
  const [modalOpen, setModalOpen] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [envoyerPour, setEnvoyerPour] = useState<number | null>(null);
  const actionIdRef = useRef<number | null>(null);
  const { mutate: agir, loading: agissant } = useMutation<unknown, { action: string }>(
    () => `/api/admin/marketing/campagnes/${actionIdRef.current}/action`, "POST",
    { invalidate: "/api/admin/marketing/campagnes" }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Mes campagnes</h2>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700">
          <Plus size={16} /> Nouvelle campagne
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading && !res ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (res?.data ?? []).length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucune campagne pour l&apos;instant</p>
        ) : res!.data.map((c) => (
          <div key={c.id}>
            <button onClick={() => setOuvert(ouvert === c.id ? null : c.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left">
              <div>
                <p className="font-medium text-slate-800">{c.nom}</p>
                <p className="text-xs text-slate-400">{c.code} · {c.typeCampagne.libelle} · {formatDate(c.dateDebut)} → {formatDate(c.dateFin)}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUT_STYLE[c.statut]}`}>{STATUT_LABEL[c.statut]}</span>
            </button>
            {ouvert === c.id && (
              <div className="px-4 pb-4 bg-slate-50/50 space-y-3">
                <div className="flex gap-4 text-xs text-slate-500">
                  <span>Budget : {c.budget ? formatCurrency(c.budget.montantPrevu) : "—"}</span>
                  <span>Agences : {c.agences.map((a) => a.pointDeVente.nom).join(", ") || "—"}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(ACTIONS_PAR_STATUT[c.statut] ?? []).map((a) => (
                    <button key={a.action} disabled={agissant}
                      onClick={async () => { actionIdRef.current = c.id; if (await agir({ action: a.action })) refetch(); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg text-xs font-semibold disabled:opacity-50 ${a.style}`}>
                      <a.icon className="w-3.5 h-3.5" /> {a.label}
                    </button>
                  ))}
                  <button onClick={() => setEnvoyerPour(c.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-semibold hover:bg-fuchsia-700">
                    <Send className="w-3.5 h-3.5" /> Envoyer à l&apos;audience
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {modalOpen && <NouvelleCampagneModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); refetch(); }} />}
      {envoyerPour !== null && <EnvoyerCampagneModal campagneId={envoyerPour} onClose={() => setEnvoyerPour(null)} />}
    </div>
  );
}

function Audiences() {
  const { data: res, loading, refetch } = useApi<{ data: AudienceItem[] }>("/api/admin/marketing/audiences");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Audiences</h2>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700">
          <Plus size={16} /> Nouvelle audience
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading && !res ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (res?.data ?? []).length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucune audience pour l&apos;instant</p>
        ) : res!.data.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-slate-800">{a.nom}</p>
              <p className="text-xs text-slate-400">{a.type === "STATIQUE" ? "Statique" : "Dynamique"} · utilisée par {a._count.campagnes} campagne(s)</p>
            </div>
            <span className="text-sm font-semibold text-slate-800">{a.tailleCalculee ?? "—"} clients</span>
          </div>
        ))}
      </div>
      {modalOpen && <NouvelleAudienceModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); refetch(); }} />}
    </div>
  );
}

interface ModeleItem { id: number; nom: string; categorie: string; actif: boolean; canal: { libelle: string }; _count: { envois: number } }

function Communication() {
  const { data: res, loading, refetch } = useApi<{ data: ModeleItem[] }>("/api/admin/marketing/modeles");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Modèles de message</h2>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700">
          <Plus size={16} /> Nouveau modèle
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading && !res ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (res?.data ?? []).length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucun modèle pour l&apos;instant</p>
        ) : res!.data.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-slate-800">{m.nom}</p>
              <p className="text-xs text-slate-400">{m.canal.libelle} · {m._count.envois} envoi(s)</p>
            </div>
            <span className={`inline-block w-2 h-2 rounded-full ${m.actif ? "bg-emerald-500" : "bg-slate-300"}`} />
          </div>
        ))}
      </div>
      {modalOpen && <ModeleMessageForm onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); refetch(); }} />}
    </div>
  );
}

function Automatisation() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Automatisation</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ListeAutomatisation />
        </div>
        <div>
          <MesTachesMarketing />
        </div>
      </div>
    </div>
  );
}

function Promotions() {
  const [vue, setVue] = useState<"promotions" | "coupons">("promotions");
  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVue("promotions")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "promotions" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Promotions</button>
        <button onClick={() => setVue("coupons")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "coupons" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Coupons</button>
      </div>
      {vue === "promotions" ? <PromotionsMarketing /> : <CouponsMarketing />}
    </div>
  );
}

function Fidelisation() {
  const [vue, setVue] = useState<"recompenses" | "challenges" | "badges">("recompenses");
  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVue("recompenses")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "recompenses" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Récompenses</button>
        <button onClick={() => setVue("challenges")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "challenges" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Challenges</button>
        <button onClick={() => setVue("badges")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "badges" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Badges</button>
      </div>
      {vue === "recompenses" && <RecompensesFidelite />}
      {vue === "challenges" && <ChallengesMarketing />}
      {vue === "badges" && <BadgesMarketing />}
    </div>
  );
}

function Terrain() {
  const [vue, setVue] = useState<"operations" | "zones">("operations");
  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVue("operations")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "operations" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Opérations</button>
        <button onClick={() => setVue("zones")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "zones" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Zones de chalandise</button>
      </div>
      {vue === "operations" && <OperationsTerrainMarketing />}
      {vue === "zones" && <ZonesChalandiseMarketing />}
    </div>
  );
}

function Acquisition() {
  const [vue, setVue] = useState<"landing" | "formulaires" | "qr">("landing");
  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVue("landing")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "landing" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Landing pages</button>
        <button onClick={() => setVue("formulaires")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "formulaires" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Formulaires</button>
        <button onClick={() => setVue("qr")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "qr" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>QR Codes</button>
      </div>
      {vue === "landing" && <LandingPagesMarketing />}
      {vue === "formulaires" && <FormulairesMarketing />}
      {vue === "qr" && <QrCodesMarketing />}
    </div>
  );
}

function Analytics() {
  const [vue, setVue] = useState<"analytics" | "tests-ab">("analytics");
  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVue("analytics")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "analytics" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Analytics</button>
        <button onClick={() => setVue("tests-ab")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "tests-ab" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Tests A/B</button>
      </div>
      {vue === "analytics" ? <AnalyticsMarketing /> : <TestsABMarketing />}
    </div>
  );
}

function Budgets() {
  const [vue, setVue] = useState<"budgets" | "depenses">("budgets");
  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVue("budgets")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "budgets" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Budgets</button>
        <button onClick={() => setVue("depenses")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "depenses" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Dépenses</button>
      </div>
      {vue === "budgets" ? <BudgetsMarketing /> : <DepensesMarketing />}
    </div>
  );
}
