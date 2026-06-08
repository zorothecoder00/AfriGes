"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Plus, X, Save,
  CheckCircle, Clock, XCircle, CreditCard,
  DollarSign, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AvantageRH {
  id:             number;
  type:           string;
  libelle:        string;
  montantMensuel: number;
  actif:          boolean;
  dateDebut:      string;
  dateFin:        string | null;
  notes:          string | null;
  createdAt:      string;
  profilRH: {
    id: number; matricule: string;
    gestionnaire: { member: { id: number; nom: string; prenom: string } };
  };
}

interface RemboursementFrais {
  id:           number;
  type:         string;
  libelle:      string;
  montant:      number;
  dateFrais:    string;
  justificatif: string | null;
  statut:       string;
  commentaire:  string | null;
  notes:        string | null;
  createdAt:    string;
  profilRH: {
    id: number; matricule: string;
    gestionnaire: { member: { id: number; nom: string; prenom: string } };
  };
}

interface AvantagesResponse { data: AvantageRH[] }
interface RembsResponse {
  data: RemboursementFrais[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  stats: Record<string, number>;
}
interface CollabsResponse {
  data: { id: number; matricule: string; gestionnaire: { member: { nom: string; prenom: string } } }[];
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const TYPE_AVANTAGE: Record<string, string> = {
  TRANSPORT:"Transport", LOGEMENT:"Logement", TELEPHONE:"Téléphone",
  REPAS:"Repas", VEHICULE:"Véhicule", ASSURANCE:"Assurance", AUTRE:"Autre",
};

const TYPE_REMB: Record<string, string> = {
  DEPLACEMENT:"Déplacement", REPAS:"Repas", HEBERGEMENT:"Hébergement",
  COMMUNICATION:"Communication", MATERIEL:"Matériel", AUTRE:"Autre",
};

const STATUT_REMB: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  EN_ATTENTE: { label: "En attente", badge: "bg-amber-100 text-amber-700",    icon: <Clock       className="w-3.5 h-3.5" /> },
  APPROUVE:   { label: "Approuvé",   badge: "bg-blue-100 text-blue-700",      icon: <CheckCircle className="w-3.5 h-3.5" /> },
  REJETE:     { label: "Rejeté",     badge: "bg-red-100 text-red-600",        icon: <XCircle     className="w-3.5 h-3.5" /> },
  PAYE:       { label: "Payé",       badge: "bg-emerald-100 text-emerald-700",icon: <CreditCard  className="w-3.5 h-3.5" /> },
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AvantagesPage() {
  const [tab, setTab] = useState<"avantages" | "remboursements">("avantages");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Avantages & Remboursements</h1>
          <p className="text-sm text-slate-500 mt-0.5">Avantages en nature et remboursements de frais</p>
        </div>
        {/* Onglets */}
        <div className="border-b border-slate-200">
          <div className="flex gap-1">
            {(["avantages", "remboursements"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}>
                {t === "avantages" ? <><DollarSign className="w-4 h-4" /> Avantages</> : <><CreditCard className="w-4 h-4" /> Remboursements</>}
              </button>
            ))}
          </div>
        </div>

        {tab === "avantages"       && <AvantagesTab />}
        {tab === "remboursements"  && <RemboursementsTab />}
      </div>
    </div>
  );
}

// ── Onglet Avantages ───────────────────────────────────────────────────────────

function AvantagesTab() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const handleSearch = useCallback((v: string) => setSearch(v), []);

  const params = new URLSearchParams();
  if (search) params.set("search", search); // note: endpoint filtre par profilRHId pas search mais on peut adapter

  const { data: res, loading, refetch } = useApi<AvantagesResponse>(`/api/admin/rh/avantages`);
  const avantages = res?.data ?? [];

  const filtered = search
    ? avantages.filter((a) => {
        const m = a.profilRH.gestionnaire.member;
        return `${m.prenom} ${m.nom}`.toLowerCase().includes(search.toLowerCase()) ||
          a.libelle.toLowerCase().includes(search.toLowerCase());
      })
    : avantages;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex gap-2">
          <button onClick={refetch} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nouvel avantage
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
          <DollarSign className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucun avantage enregistré</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered.map((a) => (
              <AvantageRow key={a.id} avantage={a} onRefetch={refetch} />
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateAvantageModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />
      )}
    </div>
  );
}

function AvantageRow({ avantage: a, onRefetch }: { avantage: AvantageRH; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/avantages/${a.id}`, "PATCH");
  const m = a.profilRH.gestionnaire.member;

  const toggle = async () => {
    const result = await mutate({ actif: !a.actif });
    if (result) { toast.success(a.actif ? "Avantage désactivé" : "Avantage activé"); onRefetch(); }
  };

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 group ${!a.actif ? "opacity-60" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/dashboard/admin/rh/collaborateurs/${a.profilRH.id}`}
            className="text-sm font-semibold text-slate-800 hover:text-emerald-600">
            {m.prenom} {m.nom}
          </Link>
          <span className="text-xs text-slate-400 font-mono">{a.profilRH.matricule}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{TYPE_AVANTAGE[a.type] ?? a.type}</span>
          {!a.actif && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-400">Inactif</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
          <span>{a.libelle}</span>
          <span className="font-semibold text-slate-700">{fmt(a.montantMensuel)} FCFA/mois</span>
          <span>Depuis {formatDate(a.dateDebut)}{a.dateFin ? ` → ${formatDate(a.dateFin)}` : ""}</span>
        </div>
      </div>
      <button onClick={toggle} disabled={loading}
        className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-opacity ${
          a.actif
            ? "text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100"
            : "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
        }`}>
        {a.actif ? "Désactiver" : "Réactiver"}
      </button>
    </div>
  );
}

// ── Onglet Remboursements ──────────────────────────────────────────────────────

function RemboursementsTab() {
  const [statut, setStatut] = useState("");
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  if (search) params.set("search", search);
  params.set("page", String(page)); params.set("limit", "20");

  const { data: res, loading, refetch } = useApi<RembsResponse>(`/api/admin/rh/remboursements-frais?${params}`);
  const rembs  = res?.data  ?? [];
  const meta   = res?.meta;
  const stats  = res?.stats ?? {};

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUT_REMB).map(([key, cfg]) => (
          <button key={key} onClick={() => setStatut(statut === key ? "" : key)}
            className={`p-4 rounded-xl border text-left transition-all ${statut === key ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400" : "bg-white border-slate-200 hover:border-slate-300"}`}>
            <div className="flex items-center gap-2 mb-1"><span className={`p-1.5 rounded-lg ${cfg.badge}`}>{cfg.icon}</span></div>
            <p className="text-2xl font-bold text-slate-900">{stats[key] ?? 0}</p>
            <p className="text-xs text-slate-500">{cfg.label}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex gap-2">
          <button onClick={refetch} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nouveau remboursement
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : rembs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
          <CreditCard className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucun remboursement trouvé</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {rembs.map((r) => <RembRow key={r.id} remb={r} onRefetch={refetch} />)}
          </div>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{meta.total} remboursements</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Précédent</button>
            <span className="px-3 py-1.5 text-sm text-slate-600">{page} / {meta.totalPages}</span>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Suivant</button>
          </div>
        </div>
      )}

      {showCreate && <CreateRembModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}

function RembRow({ remb: r, onRefetch }: { remb: RemboursementFrais; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/remboursements-frais/${r.id}`, "PATCH");
  const cfg    = STATUT_REMB[r.statut] ?? STATUT_REMB.EN_ATTENTE;
  const m      = r.profilRH.gestionnaire.member;

  const doAction = async (action: string) => {
    const result = await mutate({ action });
    if (result) { toast.success("Statut mis à jour"); onRefetch(); }
  };

  return (
    <div className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/dashboard/admin/rh/collaborateurs/${r.profilRH.id}`}
            className="text-sm font-semibold text-slate-800 hover:text-emerald-600">{m.prenom} {m.nom}</Link>
          <span className="text-xs text-slate-400 font-mono">{r.profilRH.matricule}</span>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{TYPE_REMB[r.type] ?? r.type}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
          <span>{r.libelle}</span>
          <span className="font-semibold text-slate-700">{fmt(r.montant)} FCFA</span>
          <span>{formatDate(r.dateFrais)}</span>
        </div>
        {r.commentaire && <p className="text-xs text-red-500 mt-0.5">{r.commentaire}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {r.statut === "EN_ATTENTE" && (
          <>
            <button onClick={() => doAction("APPROUVER")} disabled={loading}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50">
              <CheckCircle className="w-3.5 h-3.5 inline mr-1" />Approuver
            </button>
            <button onClick={() => doAction("REJETER")} disabled={loading}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50">
              <XCircle className="w-3.5 h-3.5 inline mr-1" />Rejeter
            </button>
          </>
        )}
        {r.statut === "APPROUVE" && (
          <button onClick={() => doAction("MARQUER_PAYE")} disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50">
            <CreditCard className="w-3.5 h-3.5 inline mr-1" />Marquer payé
          </button>
        )}
        {r.justificatif && (
          <a href={r.justificatif} target="_blank" rel="noreferrer"
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">
            Justificatif
          </a>
        )}
      </div>
    </div>
  );
}

// ── Modals ─────────────────────────────────────────────────────────────────────

function CreateAvantageModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/avantages", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];
  const [form, setForm] = useState({ profilRHId: "", type: "", libelle: "", montantMensuel: "", dateDebut: new Date().toISOString().slice(0, 10), dateFin: "", notes: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.type || !form.libelle || !form.dateDebut) { toast.error("Champs obligatoires manquants"); return; }
    const result = await mutate({ profilRHId: Number(form.profilRHId), type: form.type, libelle: form.libelle, montantMensuel: Number(form.montantMensuel || 0), dateDebut: form.dateDebut, dateFin: form.dateFin || null, notes: form.notes || null });
    if (result) { toast.success("Avantage créé"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvel avantage en nature</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <AField label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
            </select>
          </AField>
          <div className="grid grid-cols-2 gap-3">
            <AField label="Type *">
              <select value={form.type} onChange={(e) => { set("type", e.target.value); if (!form.libelle) setForm((f) => ({ ...f, libelle: TYPE_AVANTAGE[e.target.value] ?? "" })); }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">—</option>
                {Object.entries(TYPE_AVANTAGE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </AField>
            <AField label="Montant mensuel">
              <input type="number" value={form.montantMensuel} onChange={(e) => set("montantMensuel", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </AField>
          </div>
          <AField label="Libellé *">
            <input value={form.libelle} onChange={(e) => set("libelle", e.target.value)} placeholder="Description de l'avantage"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </AField>
          <div className="grid grid-cols-2 gap-3">
            <AField label="Date de début *">
              <input type="date" value={form.dateDebut} onChange={(e) => set("dateDebut", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </AField>
            <AField label="Date de fin">
              <input type="date" value={form.dateFin} onChange={(e) => set("dateFin", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </AField>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateRembModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/remboursements-frais", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];
  const [form, setForm] = useState({ profilRHId: "", type: "", libelle: "", montant: "", dateFrais: new Date().toISOString().slice(0, 10), justificatif: "", notes: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.type || !form.libelle || !form.montant || !form.dateFrais) { toast.error("Champs obligatoires manquants"); return; }
    const result = await mutate({ profilRHId: Number(form.profilRHId), type: form.type, libelle: form.libelle, montant: Number(form.montant), dateFrais: form.dateFrais, justificatif: form.justificatif || null, notes: form.notes || null });
    if (result) { toast.success("Remboursement créé"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle demande de remboursement</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <AField label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
            </select>
          </AField>
          <div className="grid grid-cols-2 gap-3">
            <AField label="Type *">
              <select value={form.type} onChange={(e) => { set("type", e.target.value); if (!form.libelle) setForm((f) => ({ ...f, libelle: TYPE_REMB[e.target.value] ?? "" })); }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">—</option>
                {Object.entries(TYPE_REMB).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </AField>
            <AField label="Montant *">
              <input type="number" value={form.montant} onChange={(e) => set("montant", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </AField>
          </div>
          <AField label="Libellé *">
            <input value={form.libelle} onChange={(e) => set("libelle", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </AField>
          <AField label="Date des frais *">
            <input type="date" value={form.dateFrais} onChange={(e) => set("dateFrais", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </AField>
          <AField label="Justificatif (URL)">
            <input value={form.justificatif} onChange={(e) => set("justificatif", e.target.value)} placeholder="https://…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </AField>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function AField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
