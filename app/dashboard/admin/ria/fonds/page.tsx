"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  RefreshCw, Plus, CheckCircle, XCircle, DollarSign,
  ArrowDownCircle, ArrowUpCircle, Activity, Search, Pencil, FileText,
} from "lucide-react";

type Tab = "depots" | "retraits" | "journal";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Investisseur { id: number; nom: string; prenom: string }

interface DepotItem {
  id: number; reference: string; montant: number; statut: string;
  modePaiement: string | null; notes: string | null; createdAt: string;
  portefeuille: {
    id: number; reference: string; nom: string | null;
    profilRIA: { gestionnaire: { member: Investisseur } };
  };
}

interface RetraitItem extends DepotItem {
  motif: string | null;
}

interface MouvementItem {
  id: number; type: string; montant: number; sens: string; description: string | null; reference: string | null; createdAt: string;
  portefeuille: {
    id: number; reference: string; nom: string | null;
    profilRIA: { gestionnaire: { member: Investisseur } };
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const toNum = (v: unknown) => Number(v ?? 0);
const fmtDate = (s: string) => new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const STATUT_BADGE: Record<string, string> = {
  EN_ATTENTE: "bg-amber-50 text-amber-700 border-amber-200",
  VALIDE:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  PAYE:       "bg-blue-50 text-blue-700 border-blue-200",
  REJETE:     "bg-red-50 text-red-600 border-red-200",
};

// ── Modal — Nouveau dépôt ─────────────────────────────────────────────────────

function DepotModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: pfRes } = useApi<{ data: { id: number; reference: string; nom: string | null; profilRIA: { gestionnaire: { member: Investisseur } } }[] }>("/api/admin/ria/portefeuilles?actif=true&limit=100");
  const pfs = pfRes?.data ?? [];

  const [form, setForm] = useState({ portefeuilleId: "", montant: "", modePaiement: "", notes: "" });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const mut = useMutation<{ data: unknown }, typeof form>("/api/admin/ria/fonds/depots", "POST");

  const submit = async () => {
    if (!form.portefeuilleId || !form.montant) { toast.error("Portefeuille et montant sont requis"); return; }
    const res = await mut.mutate({ ...form, montant: form.montant });
    if (res) { toast.success("Dépôt enregistré"); onSuccess(); onClose(); }
    else toast.error(mut.error ?? "Erreur");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between">
          <h3 className="font-semibold text-slate-900">Nouveau dépôt</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Portefeuille *</label>
            <select value={form.portefeuilleId} onChange={(e) => set("portefeuilleId", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Sélectionner…</option>
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
              {["ESPECES", "VIREMENT", "MOBILE_MONEY", "CHEQUE"].map((m) => (
                <option key={m} value={m}>{m.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
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

// ── Modal — Nouveau retrait ───────────────────────────────────────────────────

interface PortefeuilleSolde {
  id: number; reference: string; nom: string | null;
  capitalInvesti: number; capitalEngage: number; capitalDisponible: number;
  encoursFinancements: number; montantRetirable: number;
  profilRIA: { gestionnaire: { member: Investisseur } };
}

// Panneau de vérification de solvabilité avant retrait
function VerificationRetrait({ pf, montant }: { pf: PortefeuilleSolde; montant: number }) {
  const max = toNum(pf.montantRetirable);
  const depasse = montant > max;
  const lignes = [
    { label: "Capital investi",          value: toNum(pf.capitalInvesti),      color: "text-slate-900" },
    { label: "Fonds engagés",            value: toNum(pf.capitalEngage),       color: "text-amber-700" },
    { label: "Encours / créances",       value: toNum(pf.encoursFinancements), color: "text-blue-700" },
    { label: "Solde disponible",         value: toNum(pf.capitalDisponible),   color: "text-emerald-700" },
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
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
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
              {["ESPECES", "VIREMENT", "MOBILE_MONEY", "CHEQUE"].map((m) => (
                <option key={m} value={m}>{m.replace("_", " ")}</option>
              ))}
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

// ── Modal — Modifier un dépôt (EN_ATTENTE uniquement) ─────────────────────────

function EditDepotModal({ depot, onClose, onSuccess }: { depot: DepotItem; onClose: () => void; onSuccess: () => void }) {
  const { data: pfRes } = useApi<{ data: { id: number; reference: string; nom: string | null; profilRIA: { gestionnaire: { member: Investisseur } } }[] }>("/api/admin/ria/portefeuilles?actif=true&limit=100");
  const pfs = pfRes?.data ?? [];
  const [form, setForm] = useState({
    portefeuilleId: String(depot.portefeuille.id),
    montant: String(toNum(depot.montant)),
    modePaiement: depot.modePaiement ?? "",
    notes: depot.notes ?? "",
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
              {["ESPECES", "VIREMENT", "MOBILE_MONEY", "CHEQUE"].map((m) => (
                <option key={m} value={m}>{m.replace("_", " ")}</option>
              ))}
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

function EditRetraitModal({ retrait, onClose, onSuccess }: { retrait: RetraitItem; onClose: () => void; onSuccess: () => void }) {
  const { data: pfRes } = useApi<{ data: { id: number; reference: string; nom: string | null; capitalDisponible: number; profilRIA: { gestionnaire: { member: Investisseur } } }[] }>("/api/admin/ria/portefeuilles?actif=true&limit=100");
  const pfs = pfRes?.data ?? [];
  const [form, setForm] = useState({
    portefeuilleId: String(retrait.portefeuille.id),
    montant: String(toNum(retrait.montant)),
    motif: retrait.motif ?? "",
    modePaiement: retrait.modePaiement ?? "",
    notes: retrait.notes ?? "",
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
              {["ESPECES", "VIREMENT", "MOBILE_MONEY", "CHEQUE"].map((m) => (
                <option key={m} value={m}>{m.replace("_", " ")}</option>
              ))}
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

// ── Onglet Dépôts ──────────────────────────────────────────────────────────────

function DepotsTab() {
  const [statut, setStatut] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DepotItem | null>(null);

  const { data: res, loading, refetch } = useApi<{ data: DepotItem[]; meta: { total: number } }>(
    `/api/admin/ria/fonds/depots?limit=50${statut ? `&statut=${statut}` : ""}`
  );
  const depots = res?.data ?? [];

  const mut = useMutation<{ success: boolean }, { action: string; notes?: string }>("", "PATCH");

  const action = async (id: number, act: string) => {
    const res = await fetch(`/api/admin/ria/fonds/depots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act }),
    });
    const json = await res.json();
    if (res.ok) { toast.success(act === "VALIDER" ? "Dépôt validé — capital mis à jour" : "Dépôt rejeté"); refetch(); }
    else toast.error(json.error ?? "Erreur");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {["", "EN_ATTENTE", "VALIDE", "REJETE"].map((s) => (
            <button key={s} onClick={() => setStatut(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statut === s ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {s || "Tous"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nouveau dépôt
          </button>
        </div>
      </div>

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
            {loading && !depots.length && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Chargement…</td></tr>
            )}
            {!loading && depots.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Aucun dépôt</td></tr>
            )}
            {depots.map((d) => {
              const inv = d.portefeuille.profilRIA.gestionnaire.member;
              return (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.reference}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{inv.prenom} {inv.nom}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{d.portefeuille.nom ?? d.portefeuille.reference}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">{fmt(toNum(d.montant))} F</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{d.modePaiement ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${STATUT_BADGE[d.statut] ?? ""}`}>{d.statut}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(d.createdAt)}</td>
                  <td className="px-4 py-3">
                    {d.statut === "EN_ATTENTE" && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditing(d)}
                          className="p-1 text-slate-500 hover:bg-slate-100 rounded" title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => action(d.id, "VALIDER")}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Valider">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => action(d.id, "REJETER")}
                          className="p-1 text-red-500 hover:bg-red-50 rounded" title="Rejeter">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && <DepotModal onClose={() => setShowModal(false)} onSuccess={refetch} />}
      {editing && <EditDepotModal depot={editing} onClose={() => setEditing(null)} onSuccess={refetch} />}
    </div>
  );
}

// ── Onglet Retraits ────────────────────────────────────────────────────────────

function RetraitsTab() {
  const [statut, setStatut] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RetraitItem | null>(null);

  const { data: res, loading, refetch } = useApi<{ data: RetraitItem[]; meta: { total: number } }>(
    `/api/admin/ria/fonds/retraits?limit=50${statut ? `&statut=${statut}` : ""}`
  );
  const retraits = res?.data ?? [];

  const action = async (id: number, act: string) => {
    const r = await fetch(`/api/admin/ria/fonds/retraits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act }),
    });
    const json = await r.json();
    if (r.ok) { toast.success(act === "PAYER" ? "Retrait payé — capital débité" : act === "VALIDER" ? "Retrait validé" : "Retrait rejeté"); refetch(); }
    else toast.error(json.error ?? "Erreur");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {["", "EN_ATTENTE", "VALIDE", "PAYE", "REJETE"].map((s) => (
            <button key={s} onClick={() => setStatut(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statut === s ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {s || "Tous"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700">
            <Plus className="w-4 h-4" /> Demande de retrait
          </button>
        </div>
      </div>

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
            {loading && !retraits.length && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Chargement…</td></tr>
            )}
            {!loading && retraits.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Aucun retrait</td></tr>
            )}
            {retraits.map((r) => {
              const inv = r.portefeuille.profilRIA.gestionnaire.member;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.reference}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{inv.prenom} {inv.nom}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{r.portefeuille.nom ?? r.portefeuille.reference}</td>
                  <td className="px-4 py-3 font-semibold text-rose-600">{fmt(toNum(r.montant))} F</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{r.motif ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${STATUT_BADGE[r.statut] ?? ""}`}>{r.statut}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {r.statut === "EN_ATTENTE" && (
                        <>
                          <button onClick={() => setEditing(r)} className="p-1 text-slate-500 hover:bg-slate-100 rounded" title="Modifier"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => action(r.id, "VALIDER")} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Valider"><CheckCircle className="w-4 h-4" /></button>
                          <button onClick={() => action(r.id, "REJETER")} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Rejeter"><XCircle className="w-4 h-4" /></button>
                        </>
                      )}
                      {r.statut === "VALIDE" && (
                        <button onClick={() => action(r.id, "PAYER")} className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
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

      {showModal && <RetraitModal onClose={() => setShowModal(false)} onSuccess={refetch} />}
      {editing && <EditRetraitModal retrait={editing} onClose={() => setEditing(null)} onSuccess={refetch} />}
    </div>
  );
}

// ── Onglet Journal ─────────────────────────────────────────────────────────────

function JournalTab() {
  const [search, setSearch] = useState("");
  const { data: res, loading, refetch } = useApi<{ data: MouvementItem[]; meta: { total: number } }>(
    `/api/admin/ria/fonds/mouvements?limit=100`
  );
  const mouvements = res?.data ?? [];

  const filtered = search
    ? mouvements.filter((m) => {
        const inv = m.portefeuille.profilRIA.gestionnaire.member;
        return (
          `${inv.prenom} ${inv.nom}`.toLowerCase().includes(search.toLowerCase()) ||
          (m.reference ?? "").toLowerCase().includes(search.toLowerCase()) ||
          m.type.toLowerCase().includes(search.toLowerCase())
        );
      })
    : mouvements;

  const TYPE_BADGE: Record<string, string> = {
    DEPOT:               "text-emerald-700",
    RETRAIT:             "text-rose-600",
    FINANCEMENT_CLIENT:  "text-blue-600",
    REMBOURSEMENT_CLIENT:"text-violet-600",
    BENEFICE_GENERE:     "text-amber-600",
    BENEFICE_DISTRIBUE:  "text-amber-700",
    BENEFICE_REINVESTI:  "text-teal-600",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Investisseur, référence, type…"
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm w-full focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        </div>
        <button onClick={refetch} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {["Date", "Investisseur", "Portefeuille", "Type", "Sens", "Montant", "Description"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !filtered.length && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Chargement…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aucun mouvement</td></tr>
            )}
            {filtered.map((m) => {
              const inv = m.portefeuille.profilRIA.gestionnaire.member;
              return (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(m.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{inv.prenom} {inv.nom}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{m.portefeuille.nom ?? m.portefeuille.reference}</td>
                  <td className={`px-4 py-3 text-xs font-semibold ${TYPE_BADGE[m.type] ?? "text-slate-600"}`}>
                    {m.type.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${m.sens === "CREDIT" ? "text-emerald-600" : "text-rose-600"}`}>
                      {m.sens === "CREDIT" ? "▲" : "▼"} {m.sens}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-semibold tabular-nums ${m.sens === "CREDIT" ? "text-emerald-700" : "text-rose-600"}`}>
                    {m.sens === "CREDIT" ? "+" : "-"}{fmt(toNum(m.montant))} F
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">{m.description ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function RIAFondsPage() {
  const [tab, setTab] = useState<Tab>("depots");

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "depots",   label: "Dépôts",   icon: <ArrowDownCircle className="w-4 h-4" /> },
    { id: "retraits", label: "Retraits", icon: <ArrowUpCircle   className="w-4 h-4" /> },
    { id: "journal",  label: "Journal",  icon: <Activity         className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fonds RIA</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gestion des dépôts, retraits et journal des mouvements</p>
      </div>

      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === "depots"   && <DepotsTab />}
      {tab === "retraits" && <RetraitsTab />}
      {tab === "journal"  && <JournalTab />}
    </div>
  );
}
