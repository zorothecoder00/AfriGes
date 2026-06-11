"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Plus, RefreshCw, Search, AlertTriangle, XCircle, CheckCircle,
  ChevronDown, ChevronUp, TrendingDown, Activity, Wallet,
  Users, BarChart3, Link2, CreditCard,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FinancementItem {
  id: number; reference: string; statut: string;
  montantFinance: number; montantRembourse: number; encours: number;
  dateFinancement: string; dateEcheance: string | null; notes: string | null;
  portefeuille: {
    id: number; reference: string; nom: string | null; capitalDisponible: number;
    profilRIA: { gestionnaire: { member: { id: number; nom: string; prenom: string } } };
  };
  client: { id: number; nom: string; prenom: string; telephone: string | null };
  creditClient: { id: number; reference: string; statut: string } | null;
  affectation: { id: number; classeRisque: string; pourcentage: number } | null;
  _count: { remboursements: number };
}

interface PortefeuilleOption {
  id: number; reference: string; nom: string | null; capitalDisponible: number;
  profilRIA: { gestionnaire: { member: { nom: string; prenom: string } } };
}
interface ClientOption { id: number; nom: string; prenom: string; telephone: string | null }

interface FinRIALie {
  id: number; reference: string; statut: string;
  montantFinance: number; montantRembourse: number; encours: number;
  pourcentage: number | null;
  portefeuille: { id: number; reference: string; nom: string | null; investisseurNom: string };
}
interface CreditLieItem {
  creditId: number; creditReference: string; creditStatut: string;
  montantTotal: number; montantRembourse: number; soldeRestant: number;
  dateEcheanceFin: string | null;
  client: { id: number; nom: string; prenom: string; telephone: string | null };
  financementsRIA: FinRIALie[];
  totalFinanceRIA: number; totalRembourseRIA: number; totalEncoursRIA: number;
  nbPortefeuilles: number; tauxRecouvrement: number;
}
interface ParCreditStats {
  totalCredits: number; totalFinanceRIA: number; totalEncoursRIA: number;
  totalRembourseRIA: number; tauxRecouvrement: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const toNum   = (v: unknown) => Number(v ?? 0);
const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString("fr-FR") : "—";

const STATUT_FIN: Record<string, string> = {
  ACTIF:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  REMBOURSE: "bg-blue-50 text-blue-700 border-blue-200",
  EN_RETARD: "bg-amber-50 text-amber-700 border-amber-200",
  DEFAUT:    "bg-red-50 text-red-700 border-red-200",
  ANNULE:    "bg-slate-100 text-slate-500 border-slate-200",
};

const STATUT_CREDIT: Record<string, { label: string; cls: string }> = {
  ACTIF:                 { label: "Actif",       cls: "bg-emerald-100 text-emerald-700" },
  EN_RETARD:             { label: "En retard",   cls: "bg-amber-100 text-amber-700" },
  SOLDE:                 { label: "Soldé",        cls: "bg-blue-100 text-blue-700" },
  VALIDE:                { label: "Validé",       cls: "bg-sky-100 text-sky-700" },
  EN_ATTENTE_VALIDATION: { label: "En attente",  cls: "bg-slate-100 text-slate-600" },
  ANNULE:                { label: "Annulé",       cls: "bg-red-100 text-red-600" },
};

// ── CreateModal ───────────────────────────────────────────────────────────────

function CreateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: pfRes } = useApi<{ data: PortefeuilleOption[] }>("/api/admin/ria/portefeuilles?actif=true&limit=100");
  const pfs = pfRes?.data ?? [];

  const [clientSearch, setClientSearch] = useState("");
  const { data: clientRes } = useApi<{ data: ClientOption[] }>(`/api/admin/clients?limit=20&search=${encodeURIComponent(clientSearch)}`);
  const clients = clientRes?.data ?? [];

  const [form, setForm] = useState({
    portefeuilleId: "", clientId: "", montantFinance: "", creditClientId: "", dateEcheance: "", notes: "",
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const [loading, setLoading] = useState(false);
  const pfSelected = pfs.find((p) => p.id === parseInt(form.portefeuilleId));

  const submit = async () => {
    if (!form.portefeuilleId || !form.clientId || !form.montantFinance) {
      toast.error("Portefeuille, client et montant sont requis");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ria/financements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, montantFinance: Number(form.montantFinance) }),
      });
      const json = await res.json();
      if (res.ok) { toast.success("Financement créé — capital débité"); onSuccess(); onClose(); }
      else toast.error(json.error ?? "Erreur");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between">
          <h3 className="font-semibold text-slate-900">Nouveau financement client</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Portefeuille *</label>
            <select value={form.portefeuilleId} onChange={(e) => set("portefeuilleId", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
              <option value="">Sélectionner…</option>
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Rechercher un client *</label>
            <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Nom, prénom, téléphone…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 mb-1" />
            {clients.length > 0 && (
              <select value={form.clientId} onChange={(e) => set("clientId", e.target.value)} size={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500">
                <option value="">— choisir —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.prenom} {c.nom}{c.telephone ? ` · ${c.telephone}` : ""}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Montant à financer (FCFA) *</label>
            <input type="number" min={0} value={form.montantFinance} onChange={(e) => set("montantFinance", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Crédit client associé (ID)</label>
              <input type="number" value={form.creditClientId} onChange={(e) => set("creditClientId", e.target.value)}
                placeholder="Optionnel"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date d&apos;échéance</label>
              <input type="date" value={form.dateEcheance} onChange={(e) => set("dateEcheance", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Création…" : "Créer le financement"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ligne financement expandable (Tab 1) ──────────────────────────────────────

function FinancementRow({ fin, onRefetch }: { fin: FinancementItem; onRefetch: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [remb, setRemb] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pct = fin.montantFinance > 0 ? (fin.montantRembourse / fin.montantFinance) * 100 : 0;
  const inv = fin.portefeuille.profilRIA.gestionnaire.member;

  const changeStatut = async (action: string) => {
    const r = await fetch(`/api/admin/ria/financements/${fin.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await r.json();
    if (r.ok) { toast.success("Statut mis à jour"); onRefetch(); }
    else toast.error(json.error ?? "Erreur");
  };

  const addRemboursement = async () => {
    if (!remb || Number(remb) <= 0) { toast.error("Montant invalide"); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/admin/ria/financements/${fin.id}/remboursements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montant: Number(remb) }),
      });
      const json = await r.json();
      if (r.ok) {
        toast.success(json.estSolde ? "Financement soldé !" : `Encours : ${fmt(json.nouveauEncours)} FCFA`);
        setRemb(""); onRefetch();
      } else toast.error(json.error ?? "Erreur");
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <td className="px-4 py-3 font-mono text-xs text-slate-600">{fin.reference}</td>
        <td className="px-4 py-3 font-medium text-slate-900">{inv.prenom} {inv.nom}</td>
        <td className="px-4 py-3 text-slate-600 text-xs">{fin.portefeuille.nom ?? fin.portefeuille.reference}</td>
        <td className="px-4 py-3 font-medium text-slate-800">{fin.client.prenom} {fin.client.nom}</td>
        <td className="px-4 py-3 font-semibold text-blue-700">{fmt(toNum(fin.montantFinance))} F</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-xs text-slate-600 font-semibold">{fmt(toNum(fin.encours))} F</span>
          </div>
        </td>
        <td className="px-4 py-3">
          {fin.creditClient && (
            <span className="mr-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-50 text-purple-600 border border-purple-200 rounded text-xs">
              <Link2 className="w-3 h-3" /> {fin.creditClient.reference}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${STATUT_FIN[fin.statut] ?? ""}`}>
            {fin.statut.replace("_", " ")}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(fin.dateFinancement)}</td>
        <td className="px-4 py-3 text-slate-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Actions</p>
                <div className="flex flex-wrap gap-2">
                  {fin.statut === "ACTIF" && (
                    <>
                      <button onClick={() => changeStatut("MARQUER_EN_RETARD")}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100">
                        <AlertTriangle className="w-3 h-3" /> En retard
                      </button>
                      <button onClick={() => changeStatut("ANNULER")}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">
                        <XCircle className="w-3 h-3" /> Annuler
                      </button>
                    </>
                  )}
                  {fin.statut === "EN_RETARD" && (
                    <button onClick={() => changeStatut("MARQUER_DEFAUT")}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">
                      <XCircle className="w-3 h-3" /> Défaut
                    </button>
                  )}
                  {!["REMBOURSE", "ANNULE"].includes(fin.statut) && (
                    <div className="flex items-center gap-2 mt-2 w-full">
                      <input type="number" min={0} value={remb} onChange={(e) => setRemb(e.target.value)}
                        placeholder="Montant remboursement"
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:ring-2 focus:ring-emerald-500" />
                      <button onClick={addRemboursement} disabled={submitting}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
                        <CheckCircle className="w-3 h-3" /> {submitting ? "…" : "Enregistrer remboursement"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Détails</p>
                <div className="space-y-1 text-sm text-slate-600">
                  <p><span className="font-medium">Montant financé :</span> {fmt(toNum(fin.montantFinance))} FCFA</p>
                  <p><span className="font-medium">Remboursé :</span> {fmt(toNum(fin.montantRembourse))} FCFA ({Math.round(pct)}%)</p>
                  <p><span className="font-medium">Encours :</span> <span className="font-bold text-blue-700">{fmt(toNum(fin.encours))} FCFA</span></p>
                  {fin.dateEcheance && <p><span className="font-medium">Échéance :</span> {fmtDate(fin.dateEcheance)}</p>}
                  {fin.creditClient && (
                    <p><span className="font-medium">Crédit lié :</span> <span className="text-purple-700 font-medium">{fin.creditClient.reference}</span>
                      <span className="ml-1.5 text-xs">(lié automatiquement à la validation)</span>
                    </p>
                  )}
                  <p><span className="font-medium">Remboursements RIA :</span> {fin._count.remboursements}</p>
                  {fin.notes && <p className="italic text-slate-500">{fin.notes}</p>}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Ligne crédit lié expandable (Tab 2) ───────────────────────────────────────

function CreditLieRow({ item }: { item: CreditLieItem }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUT_CREDIT[item.creditStatut] ?? { label: item.creditStatut, cls: "bg-slate-100 text-slate-600" };
  const pct = item.tauxRecouvrement;
  const couverture = item.montantTotal > 0 ? (item.totalFinanceRIA / item.montantTotal) * 100 : 0;

  return (
    <>
      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <td className="px-4 py-3 font-mono text-xs text-slate-700 font-medium">{item.creditReference}</td>
        <td className="px-4 py-3 font-medium text-slate-900">{item.client.prenom} {item.client.nom}</td>
        <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(item.montantTotal)} F</td>
        <td className="px-4 py-3 text-right font-semibold text-purple-700">{fmt(item.totalFinanceRIA)} F
          <span className="ml-1 text-xs font-normal text-slate-400">({Math.round(couverture)}%)</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-xs text-emerald-700 font-semibold">{Math.round(pct)}%</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right font-semibold text-blue-700">{fmt(item.totalEncoursRIA)} F</td>
        <td className="px-4 py-3 text-center">
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
        </td>
        <td className="px-4 py-3 text-center text-xs text-slate-500">{item.nbPortefeuilles} PF</td>
        <td className="px-4 py-3 text-slate-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Crédit client</p>
                <div className="space-y-1 text-sm text-slate-600">
                  <p><span className="font-medium">Montant total :</span> {fmt(item.montantTotal)} FCFA</p>
                  <p><span className="font-medium">Remboursé :</span> {fmt(item.montantRembourse)} FCFA</p>
                  <p><span className="font-medium">Solde restant :</span> <span className="text-amber-700 font-semibold">{fmt(item.soldeRestant)} FCFA</span></p>
                  {item.dateEcheanceFin && <p><span className="font-medium">Échéance :</span> {fmtDate(item.dateEcheanceFin)}</p>}
                  {item.client.telephone && <p><span className="font-medium">Tél :</span> {item.client.telephone}</p>}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Portefeuilles financeurs ({item.financementsRIA.length})
                </p>
                <div className="space-y-2">
                  {item.financementsRIA.map((f) => {
                    const fpct = f.montantFinance > 0 ? (f.montantRembourse / f.montantFinance) * 100 : 0;
                    return (
                      <div key={f.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">
                            {f.portefeuille.investisseurNom}
                            <span className="ml-1 text-slate-400 font-normal">· {f.portefeuille.nom ?? f.portefeuille.reference}</span>
                          </p>
                          <p className="text-xs text-slate-500 font-mono">{f.reference}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-slate-800">{fmt(f.montantFinance)} F</p>
                          <p className="text-xs text-emerald-600">{Math.round(fpct)}% récupéré</p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded-full border font-medium ${STATUT_FIN[f.statut] ?? ""}`}>
                          {f.statut.replace("_", " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function FinancementsPage() {
  const [tab, setTab]             = useState<"financements" | "credits">("financements");
  const [statutFin, setStatutFin] = useState("");
  const [searchFin, setSearchFin] = useState("");
  const [searchCredit, setSearchCredit] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: finRes, loading: finLoading, refetch: refetchFin } =
    useApi<{ data: FinancementItem[]; meta: { total: number } }>(
      `/api/admin/ria/financements?limit=100${statutFin ? `&statut=${statutFin}` : ""}`
    );

  const { data: creditRes, loading: creditLoading, refetch: refetchCredit } =
    useApi<{ data: CreditLieItem[]; stats: ParCreditStats }>(
      `/api/admin/ria/financements/par-credit${searchCredit ? `?search=${encodeURIComponent(searchCredit)}` : ""}`
    );

  function refetchAll() { refetchFin(); refetchCredit(); }

  const financements = (finRes?.data ?? []).filter((f) => {
    if (!searchFin) return true;
    const inv = f.portefeuille.profilRIA.gestionnaire.member;
    const q = searchFin.toLowerCase();
    return (
      `${inv.prenom} ${inv.nom}`.toLowerCase().includes(q) ||
      `${f.client.prenom} ${f.client.nom}`.toLowerCase().includes(q) ||
      f.reference.toLowerCase().includes(q) ||
      (f.creditClient?.reference ?? "").toLowerCase().includes(q)
    );
  });

  const totalEncours = financements
    .filter((f) => ["ACTIF", "EN_RETARD"].includes(f.statut))
    .reduce((s, f) => s + toNum(f.encours), 0);

  const stats = creditRes?.stats;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" /> Financement des Clients — RIA
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Crédits financés par les investisseurs · Connexion automatique Module Crédit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetchAll}
            className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${(finLoading || creditLoading) ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Nouveau financement
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Encours actif total",
            value: `${fmt(totalEncours)} F`,
            icon: Wallet, color: "text-blue-700", bg: "bg-blue-50",
          },
          {
            label: "Financements actifs",
            value: financements.filter((f) => ["ACTIF", "EN_RETARD"].includes(f.statut)).length.toString(),
            icon: Activity, color: "text-emerald-700", bg: "bg-emerald-50",
          },
          {
            label: "Crédits liés au RIA",
            value: stats ? stats.totalCredits.toString() : "—",
            icon: CreditCard, color: "text-purple-700", bg: "bg-purple-50",
          },
          {
            label: "Taux recouvrement crédits",
            value: stats ? `${Math.round(stats.tauxRecouvrement)}%` : "—",
            icon: BarChart3, color: "text-amber-700", bg: "bg-amber-50",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">{kpi.label}</p>
              <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bannière crédits liés */}
      {stats && stats.totalFinanceRIA > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-purple-600" />
            <span className="text-purple-700 font-medium">Financement RIA via crédits</span>
          </div>
          <span className="text-slate-600"><b className="text-purple-700">{fmt(stats.totalFinanceRIA)} FCFA</b> engagés</span>
          <span className="text-slate-600"><b className="text-emerald-700">{fmt(stats.totalRembourseRIA)} FCFA</b> recouvrés</span>
          <span className="text-slate-600">Encours : <b className="text-blue-700">{fmt(stats.totalEncoursRIA)} FCFA</b></span>
          <span className="text-slate-500">sur {stats.totalCredits} crédit(s) client</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button onClick={() => setTab("financements")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "financements" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          <Activity className="w-4 h-4" /> Financements RIA
          <span className="ml-1 px-1.5 py-0.5 bg-slate-100 rounded text-xs text-slate-600">{finRes?.meta.total ?? 0}</span>
        </button>
        <button onClick={() => setTab("credits")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "credits" ? "border-purple-600 text-purple-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          <Users className="w-4 h-4" /> Crédits Clients
          <span className="ml-1 px-1.5 py-0.5 bg-slate-100 rounded text-xs text-slate-600">{stats?.totalCredits ?? 0}</span>
        </button>
      </div>

      {/* ── Tab 1 : Financements ─────────────────────────────────────────────── */}
      {tab === "financements" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {["", "ACTIF", "EN_RETARD", "DEFAUT", "REMBOURSE", "ANNULE"].map((s) => (
                <button key={s} onClick={() => setStatutFin(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statutFin === s ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  {s || "Tous"}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={searchFin} onChange={(e) => setSearchFin(e.target.value)}
                placeholder="Investisseur, client, référence, crédit…"
                className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm w-60 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Référence", "Investisseur", "Portefeuille", "Client", "Montant", "Encours", "Statut / Crédit", "Date", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {finLoading && !financements.length && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Chargement…
                  </td></tr>
                )}
                {!finLoading && financements.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    <TrendingDown className="w-6 h-6 inline mb-1" /><br />Aucun financement
                  </td></tr>
                )}
                {financements.map((fin) => (
                  <FinancementRow key={fin.id} fin={fin} onRefetch={refetchAll} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 2 : Crédits liés ─────────────────────────────────────────────── */}
      {tab === "credits" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={searchCredit} onChange={(e) => setSearchCredit(e.target.value)}
                placeholder="Référence crédit, nom client…"
                className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm w-64 focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            </div>
            <p className="text-xs text-slate-400 italic">
              Vue croisée Module Crédit ↔ RIA — remboursements automatiquement répercutés
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Réf. Crédit", "Client", "Montant crédit", "Financé RIA", "Taux recouvr.", "Encours RIA", "Statut crédit", "Portefeuilles", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {creditLoading && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Chargement…
                  </td></tr>
                )}
                {!creditLoading && (creditRes?.data ?? []).length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    <CreditCard className="w-6 h-6 inline mb-1" /><br />
                    Aucun crédit lié au RIA.<br />
                    <span className="text-xs">Les crédits sont liés automatiquement lors de leur validation si le client a une affectation RIA active.</span>
                  </td></tr>
                )}
                {(creditRes?.data ?? []).map((item) => (
                  <CreditLieRow key={item.creditId} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onSuccess={refetchAll} />}
    </div>
  );
}
