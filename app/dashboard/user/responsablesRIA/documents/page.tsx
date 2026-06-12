"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText, RefreshCw, Plus, ChevronRight, Filter, Search,
  FileSignature, Receipt, Award, BookOpen, BarChart2, TrendingUp, Shield, Landmark, PieChart,
  Archive,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

type TypeDoc =
  | "CONTRAT_INVESTISSEUR" | "RECU_INVESTISSEMENT" | "ATTESTATION_INVESTISSEMENT"
  | "RELEVE_PORTEFEUILLE"  | "RAPPORT_MENSUEL"      | "RAPPORT_ANNUEL"
  | "RAPPORT_RENTABILITE"  | "RAPPORT_RISQUE"       | "ETAT_CREANCES"
  | "RAPPORT_FINANCIER";

interface DocItem {
  id: number; type: TypeDoc; titre: string; version: number;
  mois: number | null; annee: number | null; createdAt: string;
  investisseurId: number | null; portefeuilleId: number | null; depotId: number | null;
  investisseur?: { gestionnaire?: { member?: { nom: string; prenom: string } | null } | null } | null;
  portefeuille?: { reference: string; nom: string | null } | null;
  generePar?: { nom: string; prenom: string } | null;
}
interface DocsData { data: DocItem[]; total: number }

interface InvestisseurOpt { id: number; numero: string | null; gestionnaire: { member: { nom: string; prenom: string } } | null }
interface PortefeuilleOpt { id: number; reference: string; nom: string | null }
interface DepotOpt { id: number; montant: number; statut: string; portefeuilleId: number; portefeuille?: { reference: string } | null }

const TYPE_META: Record<TypeDoc, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  CONTRAT_INVESTISSEUR:      { label: "Contrat Investisseur",  icon: <FileSignature size={14} />, color: "bg-purple-50 text-purple-700 border-purple-200",   desc: "Contrat signé entre l'investisseur et AfriSime" },
  RECU_INVESTISSEMENT:       { label: "Reçu d'Investissement", icon: <Receipt size={14} />,       color: "bg-blue-50 text-blue-700 border-blue-200",         desc: "Reçu émis à réception d'un dépôt" },
  ATTESTATION_INVESTISSEMENT:{ label: "Attestation",           icon: <Award size={14} />,          color: "bg-amber-50 text-amber-700 border-amber-200",      desc: "Attestation officielle d'investissement" },
  RELEVE_PORTEFEUILLE:       { label: "Relevé Portefeuille",   icon: <BookOpen size={14} />,      color: "bg-teal-50 text-teal-700 border-teal-200",          desc: "Situation complète d'un portefeuille" },
  RAPPORT_MENSUEL:           { label: "Rapport Mensuel",       icon: <BarChart2 size={14} />,     color: "bg-emerald-50 text-emerald-700 border-emerald-200", desc: "Rapport mensuel de performance" },
  RAPPORT_ANNUEL:            { label: "Rapport Annuel",        icon: <BarChart2 size={14} />,     color: "bg-green-50 text-green-700 border-green-200",       desc: "Bilan annuel complet" },
  RAPPORT_RENTABILITE:       { label: "Rentabilité",           icon: <TrendingUp size={14} />,    color: "bg-indigo-50 text-indigo-700 border-indigo-200",    desc: "Analyse ROI & rendement" },
  RAPPORT_RISQUE:            { label: "Rapport Risque",        icon: <Shield size={14} />,        color: "bg-red-50 text-red-700 border-red-200",             desc: "Évaluation des risques & créances" },
  ETAT_CREANCES:             { label: "État des Créances",     icon: <Landmark size={14} />,      color: "bg-orange-50 text-orange-700 border-orange-200",    desc: "Tableau des encours & impayés" },
  RAPPORT_FINANCIER:         { label: "Rapport Financier",     icon: <PieChart size={14} />,      color: "bg-slate-100 text-slate-700 border-slate-200",      desc: "Rapport financier & analytique global" },
};

const MOIS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const ANNEE_COURANTE = new Date().getFullYear();

function TypeBadge({ type }: { type: TypeDoc }) {
  const meta = TYPE_META[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

export default function DocumentsPage() {
  const [filtreType, setFiltreType] = useState<string>("");
  const [search,     setSearch]     = useState("");
  const [showModal,  setShowModal]  = useState(false);

  const url = `/api/admin/ria/documents${filtreType ? `?type=${filtreType}` : ""}`;
  const { data, loading, error, refetch } = useApi<DocsData>(url);

  const liste = useMemo(() => {
    if (!data) return [];
    let l = data.data;
    if (search.trim()) {
      const s = search.toLowerCase();
      l = l.filter((d) => d.titre.toLowerCase().includes(s) ||
        (d.portefeuille?.reference ?? "").toLowerCase().includes(s));
    }
    return l;
  }, [data, search]);

  if (loading) return (
    <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
      <RefreshCw className="w-5 h-5 animate-spin" /> Chargement…
    </div>
  );
  if (error || !data) return (
    <div className="p-8 text-red-600">Erreur. <button onClick={refetch} className="underline">Réessayer</button></div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Documents Générés — RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">Contrats · Reçus · Attestations · Rapports · État des créances</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Générer un document
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.entries(TYPE_META) as [TypeDoc, typeof TYPE_META[TypeDoc]][]).map(([key, meta]) => {
          const count = data.data.filter((d) => d.type === key).length;
          return (
            <button key={key} onClick={() => setFiltreType(filtreType === key ? "" : key)}
              className={`text-left p-3 rounded-xl border transition-colors ${filtreType === key ? meta.color : "bg-white border-slate-200 hover:bg-slate-50"}`}>
              <div className="flex items-center gap-1.5 mb-1">{meta.icon}<span className="text-xs font-semibold">{meta.label}</span></div>
              <div className="text-lg font-bold">{count}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5 text-sm text-slate-500"><Filter className="w-4 h-4" /></div>
        <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
          <option value="">Tous les types</option>
          {(Object.entries(TYPE_META) as [TypeDoc, typeof TYPE_META[TypeDoc]][]).map(([key, meta]) => (
            <option key={key} value={key}>{meta.label}</option>
          ))}
        </select>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 w-56" />
        </div>
        <button onClick={refetch} className="flex items-center gap-1 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="ml-auto text-xs text-slate-400">{liste.length} document(s)</span>
      </div>

      {liste.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aucun document{filtreType ? " pour ce type" : ""}</p>
          <p className="text-sm text-slate-400 mt-1">Cliquez sur &quot;Générer un document&quot; pour créer le premier.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {liste.map((doc) => (
            <Link key={doc.id} href={`/dashboard/user/responsablesRIA/documents/${doc.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                {TYPE_META[doc.type]?.icon ?? <FileText size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 group-hover:text-emerald-700 truncate">{doc.titre}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <TypeBadge type={doc.type} />
                  {doc.portefeuille && (
                    <span className="text-xs text-slate-500">{doc.portefeuille.reference}{doc.portefeuille.nom ? ` — ${doc.portefeuille.nom}` : ""}</span>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-slate-400 hidden md:block shrink-0">
                {doc.generePar && <p className="text-slate-600 font-medium">{doc.generePar.prenom} {doc.generePar.nom}</p>}
                <p>Généré le {new Date(doc.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <GenererModal onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); refetch(); }} />
      )}
    </div>
  );
}

function GenererModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [type, setType] = useState<TypeDoc | "">("");
  const [investisseurId, setInvestisseurId] = useState("");
  const [portefeuilleId, setPortefeuilleId] = useState("");
  const [depotId,        setDepotId]        = useState("");
  const [mois,           setMois]           = useState(String(new Date().getMonth() + 1));
  const [annee,          setAnnee]          = useState(String(ANNEE_COURANTE));

  const { data: invData   } = useApi<{ data: InvestisseurOpt[] }>("/api/admin/ria/investisseurs?limit=200");
  const { data: pfData    } = useApi<{ portefeuilles: PortefeuilleOpt[] }>("/api/admin/ria/portefeuilles?limit=200");
  const { data: depotData } = useApi<{ data: DepotOpt[] }>("/api/admin/ria/fonds/depots?statut=VALIDE&limit=100");

  const { mutate, loading } = useMutation<{ data: { id: number; titre: string } }, Record<string, unknown>>(
    "/api/admin/ria/documents", "POST"
  );

  const needsInv   = type && ["CONTRAT_INVESTISSEUR","ATTESTATION_INVESTISSEMENT"].includes(type);
  const needsPf    = type && ["RELEVE_PORTEFEUILLE","RAPPORT_MENSUEL","RAPPORT_ANNUEL","RAPPORT_RENTABILITE","RAPPORT_RISQUE"].includes(type);
  const needsMois  = type === "RAPPORT_MENSUEL";
  const needsAnnee = type === "RAPPORT_ANNUEL" || type === "RAPPORT_MENSUEL";
  const needsDepot = type === "RECU_INVESTISSEMENT";
  const pfOptional = type && ["ETAT_CREANCES","RAPPORT_FINANCIER"].includes(type);

  async function handleGenerer() {
    if (!type) { toast.error("Sélectionnez un type"); return; }
    if (needsInv && !investisseurId) { toast.error("Sélectionnez un investisseur"); return; }
    if (needsPf && !portefeuilleId) { toast.error("Sélectionnez un portefeuille"); return; }
    if (needsDepot && !depotId) { toast.error("Sélectionnez un dépôt"); return; }

    const body: Record<string, unknown> = { type };
    if (investisseurId) body.investisseurId = investisseurId;
    if (portefeuilleId) body.portefeuilleId = portefeuilleId;
    if (depotId)        body.depotId        = depotId;
    if (needsMois)      body.mois           = mois;
    if (needsAnnee)     body.annee          = annee;

    const res = await mutate(body);
    if (res?.data?.id) {
      toast.success(`Document généré : ${res.data.titre}`);
      onSuccess();
    } else {
      toast.error("Erreur lors de la génération");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-800">Générer un document RIA</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Type de document</label>
            <select value={type} onChange={(e) => { setType(e.target.value as TypeDoc); setInvestisseurId(""); setPortefeuilleId(""); setDepotId(""); }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
              <option value="">— Choisir un type —</option>
              {(Object.entries(TYPE_META) as [TypeDoc, typeof TYPE_META[TypeDoc]][]).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
            {type && <p className="text-xs text-slate-400 mt-1">{TYPE_META[type]?.desc}</p>}
          </div>

          {needsInv && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Investisseur</label>
              <select value={investisseurId} onChange={(e) => setInvestisseurId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
                <option value="">— Sélectionner —</option>
                {(invData?.data ?? []).map((inv) => (
                  <option key={inv.id} value={String(inv.id)}>
                    {inv.gestionnaire?.member ? `${inv.gestionnaire.member.prenom} ${inv.gestionnaire.member.nom}` : `INV #${inv.id}`}
                    {inv.numero ? ` (${inv.numero})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(needsPf || pfOptional) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Portefeuille{pfOptional ? " (optionnel)" : ""}
              </label>
              <select value={portefeuilleId} onChange={(e) => setPortefeuilleId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
                <option value="">— {pfOptional ? "Global (tous)" : "Sélectionner"} —</option>
                {(pfData?.portefeuilles ?? []).map((pf) => (
                  <option key={pf.id} value={String(pf.id)}>
                    {pf.reference}{pf.nom ? ` — ${pf.nom}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {needsDepot && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Dépôt</label>
              <select value={depotId} onChange={(e) => setDepotId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
                <option value="">— Sélectionner un dépôt validé —</option>
                {(depotData?.data ?? []).map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    DEP-{String(d.id).padStart(6,"0")} · {new Intl.NumberFormat("fr-FR").format(d.montant)} XOF
                    {d.portefeuille ? ` · ${d.portefeuille.reference}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(needsMois || needsAnnee) && (
            <div className="grid grid-cols-2 gap-3">
              {needsMois && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Mois</label>
                  <select value={mois} onChange={(e) => setMois(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
                    {MOIS_FR.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Année</label>
                <select value={annee} onChange={(e) => setAnnee(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
                  {[ANNEE_COURANTE - 2, ANNEE_COURANTE - 1, ANNEE_COURANTE].map((a) => (
                    <option key={a} value={String(a)}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button onClick={handleGenerer} disabled={loading || !type}
            className="flex-1 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            Générer
          </button>
        </div>
      </div>
    </div>
  );
}
