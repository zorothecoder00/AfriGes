"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  RefreshCw, ArrowDownCircle, ArrowUpCircle, Activity,
  Search, Filter, Pencil, Plus, CheckCircle, XCircle, DollarSign, FileText,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profil {
  gestionnaire: { member: { id: number; nom: string; prenom: string } };
}
interface Portefeuille {
  id: number; reference: string; nom: string | null;
  profilRIA: Profil;
}

interface Depot {
  id: number; reference: string; montant: number; statut: string;
  modePaiement: string | null; notes: string | null; createdAt: string;
  portefeuille: Portefeuille;
}
interface Retrait {
  id: number; reference: string; montant: number; statut: string;
  motif: string | null; modePaiement: string | null; notes: string | null; createdAt: string;
  portefeuille: Portefeuille;
}
interface Mouvement {
  id: number; type: string; sens: string; montant: number;
  description: string | null; reference: string | null; createdAt: string;
  portefeuille: Portefeuille;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const toNum   = (v: unknown) => Number(v ?? 0);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR");

const MODES_PAIEMENT = ["ESPECES", "VIREMENT", "MOBILE_MONEY", "CHEQUE"];

// ── Modal — Modifier un dépôt (EN_ATTENTE uniquement) ─────────────────────────
function EditDepotModal({ depot, onClose, onSuccess }: { depot: Depot; onClose: () => void; onSuccess: () => void }) {
  const { data: pfRes } = useApi<{ data: { id: number; reference: string; nom: string | null; profilRIA: Profil }[] }>("/api/admin/ria/portefeuilles?actif=true&limit=100");
  const pfs = pfRes?.data ?? [];
  const [form, setForm] = useState({
    portefeuilleId: String(depot.portefeuille.id), montant: String(toNum(depot.montant)), modePaiement: depot.modePaiement ?? "", notes: depot.notes ?? "",
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const mut = useMutation<{ data: unknown }, typeof form>(`/api/admin/ria/fonds/depots/${depot.id}`, "PATCH");
  const submit = async () => {
    if (!form.montant || Number(form.montant) <= 0) { toast.error("Montant invalide"); return; }
    const res = await mut.mutate(form);
    if (res) { toast.success("Dépôt modifié"); onSuccess(); onClose(); }
    else toast.error(mut.error ?? "Erreur");
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between">
          <h3 className="font-semibold text-slate-900">Modifier le dépôt — {depot.reference}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Portefeuille (investisseur) *</label>
            <select value={form.portefeuilleId} onChange={(e) => set("portefeuilleId", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              {pfs.map((pf) => (
                <option key={pf.id} value={pf.id}>
                  {pf.profilRIA.gestionnaire.member.prenom} {pf.profilRIA.gestionnaire.member.nom} — {pf.nom ?? pf.reference}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Montant (FCFA) *</label>
            <input type="number" min={0} value={form.montant} onChange={(e) => set("montant", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mode de paiement</label>
            <select value={form.modePaiement} onChange={(e) => set("modePaiement", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">—</option>
              {MODES_PAIEMENT.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <p className="text-xs text-slate-400">Seuls les dépôts en attente sont modifiables (avant impact sur le capital).</p>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={mut.loading}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {mut.loading ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal — Modifier un retrait (EN_ATTENTE uniquement) ───────────────────────
function EditRetraitModal({ retrait, onClose, onSuccess }: { retrait: Retrait; onClose: () => void; onSuccess: () => void }) {
  const { data: pfRes } = useApi<{ data: { id: number; reference: string; nom: string | null; capitalDisponible: number; profilRIA: Profil }[] }>("/api/admin/ria/portefeuilles?actif=true&limit=100");
  const pfs = pfRes?.data ?? [];
  const [form, setForm] = useState({
    portefeuilleId: String(retrait.portefeuille.id), montant: String(toNum(retrait.montant)), motif: retrait.motif ?? "", modePaiement: retrait.modePaiement ?? "", notes: retrait.notes ?? "",
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const mut = useMutation<{ data: unknown }, typeof form>(`/api/admin/ria/fonds/retraits/${retrait.id}`, "PATCH");
  const pfSelected = pfs.find((p) => p.id === parseInt(form.portefeuilleId));
  const submit = async () => {
    if (!form.montant || Number(form.montant) <= 0) { toast.error("Montant invalide"); return; }
    const res = await mut.mutate(form);
    if (res) { toast.success("Retrait modifié"); onSuccess(); onClose(); }
    else toast.error(mut.error ?? "Erreur");
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between">
          <h3 className="font-semibold text-slate-900">Modifier le retrait — {retrait.reference}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Portefeuille (investisseur) *</label>
            <select value={form.portefeuilleId} onChange={(e) => set("portefeuilleId", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent">
              {pfs.map((pf) => (
                <option key={pf.id} value={pf.id}>
                  {pf.profilRIA.gestionnaire.member.prenom} {pf.profilRIA.gestionnaire.member.nom} — {pf.nom ?? pf.reference}
                </option>
              ))}
            </select>
            {pfSelected && (
              <p className="text-xs text-emerald-700 mt-1">Disponible : {fmt(toNum(pfSelected.capitalDisponible))} FCFA</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Montant (FCFA) *</label>
            <input type="number" min={0} value={form.montant} onChange={(e) => set("montant", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Motif</label>
            <input value={form.motif} onChange={(e) => set("motif", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mode de paiement</label>
            <select value={form.modePaiement} onChange={(e) => set("modePaiement", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent">
              <option value="">—</option>
              {MODES_PAIEMENT.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
          </div>
          <p className="text-xs text-slate-400">Seuls les retraits en attente sont modifiables (avant paiement).</p>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={mut.loading}
            className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50">
            {mut.loading ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal — Nouvelle demande de retrait (avec vérification de solvabilité) ─────
interface PortefeuilleSolde {
  id: number; reference: string; nom: string | null;
  capitalInvesti: number; capitalEngage: number; capitalDisponible: number;
  encoursFinancements: number; montantRetirable: number;
  profilRIA: Profil;
}

function VerificationRetrait({ pf, montant }: { pf: PortefeuilleSolde; montant: number }) {
  const max = toNum(pf.montantRetirable);
  const depasse = montant > max;
  const lignes = [
    { label: "Capital investi",    value: toNum(pf.capitalInvesti),      color: "text-slate-900" },
    { label: "Fonds engagés",      value: toNum(pf.capitalEngage),       color: "text-amber-700" },
    { label: "Encours / créances", value: toNum(pf.encoursFinancements), color: "text-blue-700" },
    { label: "Solde disponible",   value: toNum(pf.capitalDisponible),   color: "text-emerald-700" },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vérification du portefeuille</p>
      {lignes.map((l) => (
        <div key={l.label} className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{l.label}</span>
          <span className={`font-semibold tabular-nums ${l.color}`}>{fmt(l.value)} F</span>
        </div>
      ))}
      <div className="flex items-center justify-between text-sm border-t border-slate-200 pt-1.5 mt-1.5">
        <span className="font-medium text-slate-700">Montant maximum retirable</span>
        <span className="font-bold tabular-nums text-rose-600">{fmt(max)} FCFA</span>
      </div>
      {montant > 0 && (
        <p className={`text-xs mt-1 ${depasse ? "text-red-600 font-medium" : "text-emerald-600"}`}>
          {depasse
            ? `Dépassement : le montant excède le maximum retirable de ${fmt(montant - max)} F`
            : `Solde après retrait : ${fmt(max - montant)} F`}
        </p>
      )}
    </div>
  );
}

function RetraitModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: pfRes } = useApi<{ data: PortefeuilleSolde[] }>("/api/admin/ria/portefeuilles?actif=true&limit=100");
  const pfs = pfRes?.data ?? [];
  const [form, setForm] = useState({ portefeuilleId: "", montant: "", motif: "", modePaiement: "", notes: "" });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const mut = useMutation<{ data: unknown }, typeof form>("/api/admin/ria/fonds/retraits", "POST");

  const pfSelected = pfs.find((p) => p.id === parseInt(form.portefeuilleId));
  const montantNum = Number(form.montant) || 0;
  const depasse = pfSelected ? montantNum > toNum(pfSelected.montantRetirable) : false;

  const submit = async () => {
    if (!form.portefeuilleId || !form.montant) { toast.error("Portefeuille et montant sont requis"); return; }
    if (depasse) { toast.error("Le montant dépasse le maximum retirable"); return; }
    const res = await mut.mutate(form);
    if (res) { toast.success("Demande de retrait enregistrée"); onSuccess(); onClose(); }
    else toast.error(mut.error ?? "Erreur");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between">
          <h3 className="font-semibold text-slate-900">Demande de retrait</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Portefeuille *</label>
            <select value={form.portefeuilleId} onChange={(e) => set("portefeuilleId", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent">
              <option value="">Sélectionner…</option>
              {pfs.map((pf) => (
                <option key={pf.id} value={pf.id}>
                  {pf.profilRIA.gestionnaire.member.prenom} {pf.profilRIA.gestionnaire.member.nom} — {pf.nom ?? pf.reference}
                </option>
              ))}
            </select>
          </div>
          {pfSelected && <VerificationRetrait pf={pfSelected} montant={montantNum} />}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Montant (FCFA) *</label>
            <input type="number" min={0} max={pfSelected ? toNum(pfSelected.montantRetirable) : undefined}
              value={form.montant} onChange={(e) => set("montant", e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:border-transparent ${depasse ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-rose-500"}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Motif</label>
            <input value={form.motif} onChange={(e) => set("motif", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mode de paiement</label>
            <select value={form.modePaiement} onChange={(e) => set("modePaiement", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent">
              <option value="">—</option>
              {MODES_PAIEMENT.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={mut.loading || depasse}
            className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50">
            {mut.loading ? "Enregistrement…" : "Demander le retrait"}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUT_DEPOT: Record<string, string> = {
  EN_ATTENTE: "bg-amber-50 text-amber-700 border-amber-200",
  VALIDE:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJETE:     "bg-red-50 text-red-600 border-red-200",
};
const STATUT_RETRAIT: Record<string, string> = {
  EN_ATTENTE: "bg-amber-50 text-amber-700 border-amber-200",
  VALIDE:     "bg-blue-50 text-blue-700 border-blue-200",
  PAYE:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJETE:     "bg-red-50 text-red-600 border-red-200",
};

type Tab = "depots" | "retraits" | "journal";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RIAFondsPage() {
  const [tab, setTab]       = useState<Tab>("depots");
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState("");
  const [editingDepot, setEditingDepot]     = useState<Depot | null>(null);
  const [editingRetrait, setEditingRetrait] = useState<Retrait | null>(null);
  const [showRetraitModal, setShowRetraitModal] = useState(false);

  const depotsQ   = useApi<{ data: Depot[];    meta: { total: number } }>(
    `/api/admin/ria/fonds/depots?limit=30${statut ? `&statut=${statut}` : ""}`
  );
  const retraitsQ = useApi<{ data: Retrait[];  meta: { total: number } }>(
    `/api/admin/ria/fonds/retraits?limit=30${statut ? `&statut=${statut}` : ""}`
  );
  const mvtsQ     = useApi<{ data: Mouvement[]; meta: { total: number } }>(
    `/api/admin/ria/fonds/mouvements?limit=50`
  );

  const loading = tab === "depots" ? depotsQ.loading : tab === "retraits" ? retraitsQ.loading : mvtsQ.loading;
  const refetch = tab === "depots" ? depotsQ.refetch : tab === "retraits" ? retraitsQ.refetch : mvtsQ.refetch;

  const depots   = depotsQ.data?.data   ?? [];
  const retraits = retraitsQ.data?.data ?? [];
  const mouvements = mvtsQ.data?.data   ?? [];

  const retraitAction = async (id: number, act: string) => {
    const res = await fetch(`/api/admin/ria/fonds/retraits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act }),
    });
    const json = await res.json();
    if (res.ok) {
      toast.success(act === "PAYER" ? "Retrait payé — capital débité" : act === "VALIDER" ? "Retrait validé" : "Retrait rejeté");
      retraitsQ.refetch();
    } else toast.error(json.error ?? "Erreur");
  };

  const filterStr = (items: { reference: string; portefeuille: Portefeuille }[]) =>
    search.trim()
      ? items.filter((x) => {
          const q = search.toLowerCase();
          const m = x.portefeuille.profilRIA.gestionnaire.member;
          return x.reference.toLowerCase().includes(q)
            || m.nom.toLowerCase().includes(q)
            || m.prenom.toLowerCase().includes(q);
        })
      : items;

  const filteredDepots   = filterStr(depots   as { reference: string; portefeuille: Portefeuille }[]) as Depot[];
  const filteredRetraits = filterStr(retraits as { reference: string; portefeuille: Portefeuille }[]) as Retrait[];

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "depots",   label: "Dépôts",    icon: <ArrowDownCircle className="w-4 h-4" />, count: depotsQ.data?.meta.total },
    { key: "retraits", label: "Retraits",  icon: <ArrowUpCircle   className="w-4 h-4" />, count: retraitsQ.data?.meta.total },
    { key: "journal",  label: "Journal",   icon: <Activity        className="w-4 h-4" />, count: mvtsQ.data?.meta.total },
  ];

  const depositStatuts  = ["EN_ATTENTE", "VALIDE", "REJETE"];
  const retraitStatuts  = ["EN_ATTENTE", "VALIDE", "PAYE", "REJETE"];
  const statutOptions   = tab === "depots" ? depositStatuts : tab === "retraits" ? retraitStatuts : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion des fonds</h1>
          <p className="text-sm text-slate-500 mt-0.5">Dépôts, retraits et journal des mouvements</p>
        </div>
        <button onClick={refetch}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-0.5">
        {TABS.map(({ key, label, icon, count }) => (
          <button key={key} onClick={() => { setTab(key); setStatut(""); setSearch(""); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {icon} {label}
            {count !== undefined && (
              <span className="ml-1 text-xs bg-slate-100 text-slate-600 rounded-full px-1.5">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filtres */}
      {tab !== "journal" && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Réf., investisseur…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={statut} onChange={(e) => setStatut(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Tous les statuts</option>
              {statutOptions.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          {tab === "retraits" && (
            <button onClick={() => setShowRetraitModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 ml-auto">
              <Plus className="w-4 h-4" /> Demande de retrait
            </button>
          )}
        </div>
      )}

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : (
        <>
          {/* Tab Dépôts */}
          {tab === "depots" && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Référence", "Investisseur", "Portefeuille", "Montant", "Mode", "Statut", "Date", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDepots.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-400">Aucun dépôt</td></tr>
                  ) : filteredDepots.map((d) => {
                    const m = d.portefeuille.profilRIA.gestionnaire.member;
                    return (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.reference}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{m.prenom} {m.nom}</td>
                        <td className="px-4 py-3 text-slate-500">{d.portefeuille.nom ?? d.portefeuille.reference}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{fmt(d.montant)} <span className="text-xs font-normal text-slate-400">F</span></td>
                        <td className="px-4 py-3 text-slate-500">{d.modePaiement ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUT_DEPOT[d.statut] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {d.statut.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{fmtDate(d.createdAt)}</td>
                        <td className="px-4 py-3">
                          {d.statut === "EN_ATTENTE" && (
                            <button onClick={() => setEditingDepot(d)} className="p-1 text-slate-500 hover:bg-slate-100 rounded" title="Modifier">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab Retraits */}
          {tab === "retraits" && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Référence", "Investisseur", "Portefeuille", "Montant", "Motif", "Statut", "Date", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRetraits.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-400">Aucun retrait</td></tr>
                  ) : filteredRetraits.map((r) => {
                    const m = r.portefeuille.profilRIA.gestionnaire.member;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.reference}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{m.prenom} {m.nom}</td>
                        <td className="px-4 py-3 text-slate-500">{r.portefeuille.nom ?? r.portefeuille.reference}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{fmt(r.montant)} <span className="text-xs font-normal text-slate-400">F</span></td>
                        <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{r.motif ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUT_RETRAIT[r.statut] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {r.statut.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{fmtDate(r.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {r.statut === "EN_ATTENTE" && (
                              <>
                                <button onClick={() => setEditingRetrait(r)} className="p-1 text-slate-500 hover:bg-slate-100 rounded" title="Modifier"><Pencil className="w-4 h-4" /></button>
                                <button onClick={() => retraitAction(r.id, "VALIDER")} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Valider"><CheckCircle className="w-4 h-4" /></button>
                                <button onClick={() => retraitAction(r.id, "REJETER")} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Rejeter"><XCircle className="w-4 h-4" /></button>
                              </>
                            )}
                            {r.statut === "VALIDE" && (
                              <button onClick={() => retraitAction(r.id, "PAYER")} className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                                <DollarSign className="w-3 h-3" /> Payer
                              </button>
                            )}
                            {(r.statut === "VALIDE" || r.statut === "PAYE") && (
                              <Link href={`/dashboard/admin/ria/fonds/retraits/${r.id}/ordre`} target="_blank"
                                className="flex items-center gap-1 px-2 py-1 border border-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-50" title="Ordre de paiement">
                                <FileText className="w-3 h-3" /> Ordre
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab Journal */}
          {tab === "journal" && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Date", "Investisseur", "Portefeuille", "Type", "Sens", "Montant", "Référence", "Description"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mouvements.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-400">Aucun mouvement</td></tr>
                  ) : mouvements.map((mv) => {
                    const m = mv.portefeuille.profilRIA.gestionnaire.member;
                    return (
                      <tr key={mv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDate(mv.createdAt)}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{m.prenom} {m.nom}</td>
                        <td className="px-4 py-3 text-slate-500">{mv.portefeuille.nom ?? mv.portefeuille.reference}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{mv.type.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold ${mv.sens === "CREDIT" ? "text-emerald-600" : "text-red-500"}`}>
                            {mv.sens === "CREDIT" ? "▲" : "▼"}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-semibold ${mv.sens === "CREDIT" ? "text-emerald-700" : "text-red-600"}`}>
                          {fmt(mv.montant)} <span className="text-xs font-normal text-slate-400">F</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{mv.reference ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-400 max-w-[180px] truncate">{mv.description ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editingDepot && (
        <EditDepotModal depot={editingDepot} onClose={() => setEditingDepot(null)} onSuccess={depotsQ.refetch} />
      )}
      {editingRetrait && (
        <EditRetraitModal retrait={editingRetrait} onClose={() => setEditingRetrait(null)} onSuccess={retraitsQ.refetch} />
      )}
      {showRetraitModal && (
        <RetraitModal onClose={() => setShowRetraitModal(false)} onSuccess={retraitsQ.refetch} />
      )}
    </div>
  );
}
