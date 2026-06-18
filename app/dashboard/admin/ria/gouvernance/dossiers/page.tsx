"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  FileText, Plus, Search, RefreshCw,
  Send, CheckCircle2, XCircle, Clock, Archive, Inbox, Hourglass,
  MessageSquare, GitBranch, Eye, ArrowRight, History, Lock,
} from "lucide-react";
import { DOSSIER_ROUTAGE_FIXE } from "@/lib/commissionsRIA";

interface DossierIC {
  id: number;
  reference: string;
  titre: string;
  type: string;
  statut: string;
  commissionEmettrice: string;
  commissionReceptrice: string;
  creePar: { nom: string; prenom: string };
  montantDemande: string | number | null;
  createdAt: string;
  _count: { echanges: number; versions: number };
}

interface Data { dossiers: DossierIC[] }

const STATUTS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  EN_PREPARATION:      { label: "En préparation",       color: "bg-slate-100 text-slate-600",     icon: <FileText className="w-3.5 h-3.5" /> },
  TRANSMIS:            { label: "Transmis",             color: "bg-blue-100 text-blue-700",       icon: <Send className="w-3.5 h-3.5" /> },
  RECU:                { label: "Reçu",                 color: "bg-indigo-100 text-indigo-700",   icon: <Inbox className="w-3.5 h-3.5" /> },
  EN_ANALYSE:          { label: "En analyse",           color: "bg-amber-100 text-amber-700",     icon: <Clock className="w-3.5 h-3.5" /> },
  EN_ATTENTE_DECISION: { label: "En attente décision",  color: "bg-orange-100 text-orange-700",   icon: <Hourglass className="w-3.5 h-3.5" /> },
  APPROUVE:            { label: "Financement autorisé",  color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  REJETE:              { label: "Rejeté",                color: "bg-rose-100 text-rose-700",       icon: <XCircle className="w-3.5 h-3.5" /> },
  EN_COURS_EXECUTION:  { label: "En cours d'exécution",  color: "bg-cyan-100 text-cyan-700",       icon: <RefreshCw className="w-3.5 h-3.5" /> },
  EXECUTE:             { label: "Clôturé",               color: "bg-teal-100 text-teal-700",       icon: <Archive className="w-3.5 h-3.5" /> },
};

const TYPE_LABELS: Record<string, string> = {
  DEMANDE_FINANCEMENT: "Demande de financement",
  RAPPORT_AUDIT:       "Rapport d'audit",
  RECOMMANDATION:      "Recommandation",
  PLAN_ACTION:         "Plan d'action",
  AUTRE:               "Autre",
};

const COMM_LABELS: Record<string, string> = {
  FINANCE:            "Finance",
  OPERATIONS_TERRAIN: "Opérations",
  AUDIT:               "Audit & Contrôle",
  OPTIMISATION:        "Optimisation",
};

function StatusBadge({ statut }: { statut: string }) {
  const s = STATUTS[statut] || { label: statut, color: "bg-slate-100 text-slate-600", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.icon}{s.label}
    </span>
  );
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    titre: "", type: "DEMANDE_FINANCEMENT",
    commissionEmettrice: "OPERATIONS_TERRAIN", commissionReceptrice: "FINANCE",
    description: "", montantDemande: "",
    region: "", agence: "", dureeCycleJours: "", risqueEstime: "MOYEN",
  });
  const { mutate, loading } = useMutation("/api/admin/ria/commissions/gouvernance/dossiers", "POST");

  // Routage imposé par le CDC pour le type sélectionné (ex. financement : Opérations → Finance).
  const routage = DOSSIER_ROUTAGE_FIXE[form.type as keyof typeof DOSSIER_ROUTAGE_FIXE];
  const emettrice = routage ? routage.emettrice : form.commissionEmettrice;
  const receptrice = routage ? routage.receptrice : form.commissionReceptrice;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (emettrice === receptrice) {
      toast.error("Les commissions émettrice et réceptrice doivent être différentes");
      return;
    }
    const contenuInitial = form.type === "DEMANDE_FINANCEMENT"
      ? {
          region: form.region, agence: form.agence,
          dureeCycleJours: form.dureeCycleJours ? Number(form.dureeCycleJours) : undefined,
          risqueEstime: form.risqueEstime,
          clients: [],
          investisseursConcernes: [],
        }
      : undefined;

    const res = await mutate({
      titre: form.titre,
      type: form.type,
      commissionEmettrice: emettrice,
      commissionReceptrice: receptrice,
      description: form.description,
      montantDemande: form.montantDemande || undefined,
      contenuInitial,
    }) as { id?: number; reference?: string; error?: string } | null;
    if (res?.id) { toast.success(`Dossier ${res.reference} créé`); onDone(); }
    else toast.error(res?.error || "Erreur");
  }

  const commissions = [
    { value: "FINANCE", label: "Finance" },
    { value: "OPERATIONS_TERRAIN", label: "Opérations Terrain" },
    { value: "AUDIT", label: "Audit & Contrôle" },
    { value: "OPTIMISATION", label: "Optimisation" },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-violet-500" /> Nouveau dossier inter-commission
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              placeholder="Objet du dossier" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
              {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {routage ? (
            <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-violet-700 mb-2">
                <Lock className="w-3.5 h-3.5" /> Circuit imposé par le cahier des charges
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200">{COMM_LABELS[routage.emettrice]}</span>
                <ArrowRight className="w-4 h-4 text-violet-400" />
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200">{COMM_LABELS[routage.receptrice]}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Commission émettrice *</label>
                <select value={form.commissionEmettrice} onChange={e => setForm(f => ({ ...f, commissionEmettrice: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                  {commissions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Commission réceptrice *</label>
                <select value={form.commissionReceptrice} onChange={e => setForm(f => ({ ...f, commissionReceptrice: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                  {commissions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              placeholder="Contexte et objectif..." />
          </div>

          {form.type === "DEMANDE_FINANCEMENT" && (
            <div className="space-y-3 bg-violet-50/50 border border-violet-100 rounded-xl p-4">
              <p className="text-xs font-medium text-violet-700">Informations de la demande de financement</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Montant demandé (FCFA)</label>
                  <input type="number" value={form.montantDemande} onChange={e => setForm(f => ({ ...f, montantDemande: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Durée du cycle (jours)</label>
                  <input type="number" value={form.dureeCycleJours} onChange={e => setForm(f => ({ ...f, dureeCycleJours: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Région</label>
                  <input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Agence</label>
                  <input value={form.agence} onChange={e => setForm(f => ({ ...f, agence: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Risque estimé</label>
                <select value={form.risqueEstime} onChange={e => setForm(f => ({ ...f, risqueEstime: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                  <option value="FAIBLE">Faible</option>
                  <option value="MOYEN">Moyen</option>
                  <option value="ELEVE">Élevé</option>
                </select>
              </div>
              <p className="text-xs text-slate-500">
                La liste des clients, produits et pièces jointes se complète depuis le détail du dossier, avant transmission.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {loading ? "Création..." : "Créer le dossier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DossiersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [filterComm, setFilterComm] = useState("");
  const [refresh, setRefresh] = useState(0);

  const params = new URLSearchParams();
  if (filterStatut) params.set("statut", filterStatut);
  if (filterComm) params.set("commissionEmettrice", filterComm);
  if (refresh > 0) params.set("_r", String(refresh));
  const { data, loading } = useApi<Data>(
    `/api/admin/ria/commissions/gouvernance/dossiers?${params.toString()}`
  );

  const items = (data?.dossiers || []).filter(d =>
    !search || d.titre.toLowerCase().includes(search.toLowerCase()) || d.reference.toLowerCase().includes(search.toLowerCase())
  );

  const byStatut = Object.keys(STATUTS).reduce<Record<string, number>>((acc, k) => {
    acc[k] = (data?.dossiers || []).filter(d => d.statut === k).length;
    return acc;
  }, {});

  function done() { setShowCreate(false); setRefresh(r => r + 1); }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-violet-600" /> Dossiers Inter-Commissions
          </h1>
          <p className="text-sm text-slate-500">Workflow de transmission et collaboration inter-commissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/admin/ria/gouvernance/dossiers/echanges"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            <History className="w-4 h-4" /> Historique des échanges
          </Link>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700">
            <Plus className="w-4 h-4" /> Nouveau dossier
          </button>
        </div>
      </div>

      {/* Sous-menu / compteurs par statut */}
      {!loading && (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {Object.entries(STATUTS).map(([k, s]) => (
            <button key={k} onClick={() => setFilterStatut(filterStatut === k ? "" : k)}
              className={`p-3 rounded-xl border text-center transition-all ${filterStatut === k ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <p className="text-xl font-bold text-slate-800">{byStatut[k] || 0}</p>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Référence ou titre..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
        </div>
        <select value={filterComm} onChange={e => setFilterComm(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
          <option value="">Toutes commissions</option>
          {Object.entries(COMM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button onClick={() => setRefresh(r => r + 1)}
          className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
              <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun dossier inter-commission</p>
            </div>
          ) : items.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-violet-200 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-xs font-mono text-slate-400">{d.reference}</span>
                    <StatusBadge statut={d.statut} />
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-50 text-slate-500">
                      {TYPE_LABELS[d.type] || d.type}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">{d.titre}</h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" />
                      {COMM_LABELS[d.commissionEmettrice] || d.commissionEmettrice}
                      <span className="text-slate-300">→</span>
                      {COMM_LABELS[d.commissionReceptrice] || d.commissionReceptrice}
                    </span>
                    <span>{d.creePar.prenom} {d.creePar.nom}</span>
                    <span>{new Date(d.createdAt).toLocaleDateString("fr-FR")}</span>
                    {d.montantDemande && <span className="font-medium text-slate-600">{Number(d.montantDemande).toLocaleString("fr-FR")} FCFA</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" /> {d._count.echanges}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3.5 h-3.5" /> v{d._count.versions}
                      </span>
                    </div>
                  </div>
                  <a href={`/dashboard/admin/ria/gouvernance/dossiers/${d.id}`}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                    <Eye className="w-3.5 h-3.5" /> Détail
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onDone={done} />}
    </div>
  );
}
