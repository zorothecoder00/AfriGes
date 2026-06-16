"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Plus, RefreshCw, Search, Users, ToggleLeft, ToggleRight,
  AlertTriangle, PieChart, CheckCircle, Pencil,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AffectationItem {
  id: number; pourcentage: number; montantAlloue: number; classeRisque: string;
  actif: boolean; dateDebut: string; dateFin: string | null; notes: string | null;
  encoursActuel: number; disponible: number;
  portefeuille: {
    id: number; reference: string; nom: string | null;
    profilRIA: { gestionnaire: { member: { id: number; nom: string; prenom: string } } };
  };
  client: { id: number; nom: string; prenom: string; telephone: string | null; niveauRisque: string | null; scoreSolvabilite: number | null };
  _count: { financements: number };
}

interface PortefeuilleOpt {
  id: number; reference: string; nom: string | null; capitalInvesti: number;
  profilRIA: { gestionnaire: { member: { nom: string; prenom: string } } };
}
interface ClientOpt { id: number; nom: string; prenom: string; telephone: string | null }

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const toNum   = (v: unknown) => Number(v ?? 0);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR");

const RISQUE_STYLE: Record<string, string> = {
  A: "bg-emerald-50 text-emerald-700", B: "bg-blue-50 text-blue-700",
  C: "bg-amber-50 text-amber-700",     D: "bg-orange-50 text-orange-700",
  E: "bg-red-50 text-red-700",
};

// ── Modal création affectation ────────────────────────────────────────────────

function CreateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: pfRes } = useApi<{ data: PortefeuilleOpt[] }>("/api/admin/ria/portefeuilles?actif=true&limit=100");
  const pfs = pfRes?.data ?? [];

  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientOpt | null>(null);

  const { data: clientRes } = useApi<{ data: ClientOpt[] }>(
    clientSearch.length >= 1
      ? `/api/admin/clients?limit=100&search=${encodeURIComponent(clientSearch)}`
      : `/api/admin/clients?limit=50`
  );
  const clients = clientRes?.data ?? [];

  const [form, setForm] = useState({
    portefeuilleId: "", clientId: "", pourcentage: "", classeRisque: "A", notes: "",
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const [loading, setLoading] = useState(false);

  // "pourcentage" | "montant" — ce que l'utilisateur saisit
  const [saisieMode, setSaisieMode] = useState<"pourcentage" | "montant">("pourcentage");
  // valeur brute saisie dans le champ actif
  const [valeurSaisie, setValeurSaisie] = useState("");

  // Capital du portefeuille sélectionné
  const selectedPf     = pfs.find((p) => String(p.id) === form.portefeuilleId);
  const capitalInvesti = selectedPf ? Number(selectedPf.capitalInvesti) : 0;

  // Forcer mode pourcentage quand pas de capital (montant ne peut pas se convertir)
  const modeEffectif = capitalInvesti === 0 ? "pourcentage" : saisieMode;

  const valNum = parseFloat(valeurSaisie) || 0;

  // Calculs dérivés
  const pourcentageCalcule = modeEffectif === "montant" && capitalInvesti > 0
    ? parseFloat((valNum / capitalInvesti * 100).toFixed(2))
    : valNum;
  const montantCalcule = capitalInvesti > 0
    ? Math.round(pourcentageCalcule / 100 * capitalInvesti)
    : 0;

  // Valeur affichée dans l'info-bulle de l'autre champ
  const autreValeurAffichee = modeEffectif === "pourcentage"
    ? capitalInvesti > 0 ? `${new Intl.NumberFormat("fr-FR").format(montantCalcule)} FCFA` : "—"
    : `${pourcentageCalcule.toFixed(2)} %`;

  const handleValeurSaisie = (v: string) => {
    setValeurSaisie(v);
    // Met à jour le pourcentage dans form (c'est lui qui part à l'API)
    const n = parseFloat(v) || 0;
    const pct = modeEffectif === "montant" && capitalInvesti > 0
      ? parseFloat((n / capitalInvesti * 100).toFixed(4))
      : n;
    set("pourcentage", String(pct));
  };

  const handleModeChange = (mode: "pourcentage" | "montant") => {
    if (capitalInvesti === 0 && mode === "montant") return; // pas de capital → mode montant impossible
    setSaisieMode(mode);
    setValeurSaisie(""); // reset la saisie au changement de mode
    set("pourcentage", "");
  };

  // Affectations actives du portefeuille (jauge %)
  const { data: aff0Res } = useApi<{ data: { pourcentage: number; clientId: number }[] }>(
    form.portefeuilleId
      ? `/api/admin/ria/affectations?portefeuilleId=${form.portefeuilleId}&actif=true&limit=100`
      : null
  );
  const sommeDejAllouee = (aff0Res?.data ?? [])
    .filter((a) => String(a.clientId) !== form.clientId)
    .reduce((s, a) => s + Number(a.pourcentage), 0);
  const totalAvecNouveau = sommeDejAllouee + (Number(form.pourcentage) || 0);
  const depassement = totalAvecNouveau > 100;

  const submit = async () => {
    if (!form.portefeuilleId || !form.clientId || !form.pourcentage || Number(form.pourcentage) <= 0) {
      toast.error("Portefeuille, client et une valeur d'allocation sont requis");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ria/affectations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // On n'envoie que le pourcentage — le serveur calcule montantAlloue
        body: JSON.stringify({
          portefeuilleId: form.portefeuilleId,
          clientId:       form.clientId,
          pourcentage:    Number(form.pourcentage),
          classeRisque:   form.classeRisque,
          notes:          form.notes,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Affectation créée");
        if (json.warning) toast.warning(json.warning, { duration: 6000 });
        onSuccess(); onClose();
      } else {
        toast.error(json.error ?? "Erreur");
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between">
          <h3 className="font-semibold text-slate-900">Nouvelle affectation client</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
        </div>
        <div className="p-6 space-y-4">

          {/* Portefeuille */}
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

            {form.portefeuilleId && (
              <div className="mt-2 space-y-1">
                {capitalInvesti > 0 && (
                  <p className="text-xs text-slate-400">
                    Capital total : <span className="font-medium text-slate-600">{fmt(capitalInvesti)} FCFA</span>
                  </p>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-slate-500">
                    <PieChart className="w-3 h-3" /> Déjà alloué : <span className="font-semibold text-slate-700">{sommeDejAllouee.toFixed(1)}%</span>
                  </span>
                  <span className={`font-semibold ${depassement ? "text-red-600" : "text-slate-500"}`}>
                    Total : {totalAvecNouveau.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, sommeDejAllouee)}%` }} />
                  {Number(form.pourcentage) > 0 && (
                    <div className={`h-full transition-all ${depassement ? "bg-red-400" : "bg-blue-400"}`}
                      style={{ width: `${Math.min(100 - Math.min(100, sommeDejAllouee), Number(form.pourcentage))}%` }} />
                  )}
                </div>
                {depassement && (
                  <p className="flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    Dépassement de {(totalAvecNouveau - 100).toFixed(1)}% — autorisé
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Client */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>

            {/* Chip client sélectionné */}
            {selectedClient && (
              <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="font-medium">{selectedClient.prenom} {selectedClient.nom}</span>
                {selectedClient.telephone && <span className="text-xs opacity-70">{selectedClient.telephone}</span>}
                <button type="button" onClick={() => { set("clientId", ""); setSelectedClient(null); }}
                  className="ml-auto text-emerald-400 hover:text-emerald-700 font-bold text-lg leading-none">×</button>
              </div>
            )}

            {/* Recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)}
                placeholder={selectedClient ? "Changer de client…" : "Rechercher par nom, téléphone…"}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>

            {/* Liste résultats */}
            {(clientSearch.length >= 1 || !selectedClient) && clients.length > 0 && (
              <div className="mt-1 max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50 shadow-sm">
                {clients.map((c) => {
                  const isSel = form.clientId === String(c.id);
                  return (
                    <button key={c.id} type="button"
                      onClick={() => { set("clientId", String(c.id)); setSelectedClient(c); setClientSearch(""); }}
                      className={`w-full px-3 py-2.5 text-sm flex items-center justify-between gap-3 transition-colors text-left ${
                        isSel ? "bg-emerald-50 text-emerald-900" : "hover:bg-slate-50 text-slate-700"
                      }`}>
                      <span>
                        <span className={`font-medium ${isSel ? "text-emerald-800" : ""}`}>{c.prenom} {c.nom}</span>
                        {c.telephone && <span className="text-xs text-slate-400 ml-2">{c.telephone}</span>}
                      </span>
                      {isSel && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
            {clientSearch.length >= 1 && clients.length === 0 && (
              <p className="mt-1 text-xs text-slate-400 px-1">Aucun résultat pour « {clientSearch} »</p>
            )}
          </div>

          {/* Allocation — un seul champ actif à la fois */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Allocation *</label>

            {/* Toggle mode */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-3 w-fit">
              <button
                type="button"
                onClick={() => handleModeChange("pourcentage")}
                className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                  modeEffectif === "pourcentage"
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                Par pourcentage (%)
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("montant")}
                disabled={capitalInvesti === 0}
                title={capitalInvesti === 0 ? "Pas de capital investi dans ce portefeuille" : undefined}
                className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                  modeEffectif === "montant"
                    ? "bg-emerald-600 text-white"
                    : capitalInvesti === 0
                    ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                Par montant (FCFA)
              </button>
            </div>

            {/* Champ unique actif */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  min={0}
                  max={modeEffectif === "pourcentage" ? 200 : undefined}
                  value={valeurSaisie}
                  onChange={(e) => handleValeurSaisie(e.target.value)}
                  placeholder={modeEffectif === "pourcentage" ? "ex : 15" : "ex : 1 500 000"}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:border-transparent ${
                    depassement ? "border-red-300 focus:ring-red-400" : "border-slate-200 focus:ring-emerald-500"
                  }`}
                />
              </div>
              <span className="text-sm font-semibold text-slate-500 flex-shrink-0">
                {modeEffectif === "pourcentage" ? "%" : "FCFA"}
              </span>
            </div>

            {/* Valeur dérivée — lecture seule */}
            {valeurSaisie && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-500">
                  {modeEffectif === "pourcentage" ? "Montant correspondant :" : "Pourcentage correspondant :"}
                </span>
                <span className="text-xs font-semibold text-emerald-700">{autreValeurAffichee}</span>
              </div>
            )}

            {capitalInvesti === 0 && (
              <p className="flex items-center gap-1 text-xs text-amber-600 mt-2">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                Pas de capital investi — le montant alloué sera recalculé automatiquement au premier dépôt validé.
              </p>
            )}
          </div>

          {/* Classe risque */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Classe de risque</label>
            <select value={form.classeRisque} onChange={(e) => set("classeRisque", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              {["A", "B", "C", "D", "E"].map((r) => <option key={r} value={r}>Classe {r}</option>)}
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={loading || !form.clientId}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal édition affectation (admin uniquement) ──────────────────────────────

function EditModal({
  affectation,
  onClose,
  onSuccess,
}: {
  affectation: AffectationItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Dériver le capital investi depuis montantAlloue / pourcentage
  const capitalInvesti = toNum(affectation.pourcentage) > 0
    ? Math.round(toNum(affectation.montantAlloue) / (toNum(affectation.pourcentage) / 100))
    : 0;

  const [saisieMode, setSaisieMode] = useState<"pourcentage" | "montant">("pourcentage");
  const [valeurSaisie, setValeurSaisie] = useState(toNum(affectation.pourcentage).toFixed(2));
  const [classeRisque, setClasseRisque] = useState(affectation.classeRisque);
  const [notes, setNotes] = useState(affectation.notes ?? "");
  const [dateDebut, setDateDebut] = useState(
    affectation.dateDebut ? affectation.dateDebut.slice(0, 10) : ""
  );
  const [loading, setLoading] = useState(false);

  const valNum = parseFloat(valeurSaisie) || 0;
  const pourcentageCalcule = saisieMode === "montant" && capitalInvesti > 0
    ? parseFloat((valNum / capitalInvesti * 100).toFixed(4))
    : valNum;
  const montantCalcule = capitalInvesti > 0
    ? Math.round(pourcentageCalcule / 100 * capitalInvesti)
    : toNum(affectation.montantAlloue);

  const handleValeurSaisie = (v: string) => {
    setValeurSaisie(v);
  };

  const handleModeChange = (mode: "pourcentage" | "montant") => {
    if (capitalInvesti === 0 && mode === "montant") return;
    setSaisieMode(mode);
    if (mode === "pourcentage") {
      setValeurSaisie(toNum(affectation.pourcentage).toFixed(2));
    } else {
      setValeurSaisie(toNum(affectation.montantAlloue).toFixed(0));
    }
  };

  const submit = async () => {
    if (!valeurSaisie || Number(valeurSaisie) <= 0) {
      toast.error("Valeur d'allocation invalide");
      return;
    }
    if (!dateDebut) {
      toast.error("Date de début requise");
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        classeRisque,
        notes: notes || null,
        dateDebut,
      };
      if (saisieMode === "pourcentage") {
        body.pourcentage = pourcentageCalcule;
      } else {
        body.montantAlloue = montantCalcule;
      }

      const res = await fetch(`/api/admin/ria/affectations/${affectation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Affectation mise à jour");
        onSuccess();
        onClose();
      } else {
        toast.error(json.error ?? "Erreur");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-slate-900">Modifier l&apos;affectation</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {affectation.client.prenom} {affectation.client.nom} — {affectation.portefeuille.nom ?? affectation.portefeuille.reference}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
        </div>
        <div className="p-6 space-y-4">

          {/* Date de début */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date de début d&apos;affectation *</label>
            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              Seuls les financements après cette date seront comptés dans la ligne de crédit.
            </p>
          </div>

          {/* Allocation */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Allocation (ligne de crédit)</label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-3 w-fit">
              <button type="button" onClick={() => handleModeChange("pourcentage")}
                className={`px-4 py-1.5 text-xs font-medium transition-colors ${saisieMode === "pourcentage" ? "bg-emerald-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                Par % du capital
              </button>
              <button type="button" onClick={() => handleModeChange("montant")}
                disabled={capitalInvesti === 0}
                className={`px-4 py-1.5 text-xs font-medium transition-colors ${saisieMode === "montant" ? "bg-emerald-600 text-white" : capitalInvesti === 0 ? "bg-slate-50 text-slate-300 cursor-not-allowed" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                Par montant (FCFA)
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input type="number" min={0} value={valeurSaisie}
                onChange={e => handleValeurSaisie(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              <span className="text-sm font-semibold text-slate-500 shrink-0">
                {saisieMode === "pourcentage" ? "%" : "FCFA"}
              </span>
            </div>
            {valeurSaisie && capitalInvesti > 0 && (
              <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500">
                {saisieMode === "pourcentage"
                  ? <>Montant correspondant&nbsp;: <span className="font-semibold text-emerald-700">{new Intl.NumberFormat("fr-FR").format(montantCalcule)} FCFA</span></>
                  : <>Pourcentage correspondant&nbsp;: <span className="font-semibold text-emerald-700">{pourcentageCalcule.toFixed(2)} %</span></>
                }
              </div>
            )}
          </div>

          {/* Classe de risque */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Classe de risque</label>
            <select value={classeRisque} onChange={e => setClasseRisque(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              {["A", "B", "C", "D", "E"].map(r => <option key={r} value={r}>Classe {r}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              placeholder="Observations sur cette affectation..." />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AffectationsPage() {
  const [actif, setActif] = useState("true");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingAffectation, setEditingAffectation] = useState<AffectationItem | null>(null);

  const { data: res, loading, refetch } = useApi<{ data: AffectationItem[]; meta: { total: number } }>(
    `/api/admin/ria/affectations?limit=50&actif=${actif}`
  );

  const affectations = (res?.data ?? []).filter((a) => {
    if (!search) return true;
    const inv = a.portefeuille.profilRIA.gestionnaire.member;
    return (
      `${inv.prenom} ${inv.nom}`.toLowerCase().includes(search.toLowerCase()) ||
      `${a.client.prenom} ${a.client.nom}`.toLowerCase().includes(search.toLowerCase())
    );
  });

  const toggleActif = async (id: number, current: boolean) => {
    const r = await fetch(`/api/admin/ria/affectations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !current }),
    });
    if (r.ok) { toast.success(current ? "Affectation désactivée" : "Affectation réactivée"); refetch(); }
    else { const j = await r.json(); toast.error(j.error ?? "Erreur"); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Affectations Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">{res?.meta.total ?? 0} affectation(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nouvelle affectation
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {[["true", "Actives"], ["false", "Inactives"], ["", "Toutes"]].map(([val, lbl]) => (
            <button key={val} onClick={() => setActif(val)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${actif === val ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              {lbl}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Investisseur ou client…"
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm w-52 focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {["Investisseur", "Portefeuille", "Client", "Risque client", "% Alloué", "Ligne de crédit", "Classe", "Depuis", "Actif", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !affectations.length && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Chargement…
              </td></tr>
            )}
            {!loading && affectations.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                <Users className="w-6 h-6 inline mb-1" /><br />Aucune affectation
              </td></tr>
            )}
            {affectations.map((a) => {
              const inv = a.portefeuille.profilRIA.gestionnaire.member;
              return (
                <tr key={a.id} className={`hover:bg-slate-50 ${!a.actif ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 font-medium text-slate-900">{inv.prenom} {inv.nom}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{a.portefeuille.nom ?? a.portefeuille.reference}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{a.client.prenom} {a.client.nom}</p>
                    {a.client.telephone && <p className="text-xs text-slate-400">{a.client.telephone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {a.client.niveauRisque ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{a.client.niveauRisque}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">{toNum(a.pourcentage).toFixed(1)}%</td>
                  <td className="px-4 py-3 min-w-[180px]">
                    {toNum(a.montantAlloue) > 0 ? (() => {
                      const pct    = Math.min(100, (a.encoursActuel / toNum(a.montantAlloue)) * 100);
                      const surPct = pct >= 100;
                      return (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Limite&nbsp;: <span className="font-semibold text-slate-700">{fmt(toNum(a.montantAlloue))} F</span></span>
                            <span className={surPct ? "text-red-600 font-semibold" : "text-slate-400"}>{pct.toFixed(0)}% utilisé</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${surPct ? "bg-red-500" : pct > 75 ? "bg-amber-400" : "bg-emerald-500"}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-blue-600">Encours&nbsp;: <span className="font-semibold">{fmt(a.encoursActuel)} F</span></span>
                            <span className={`font-semibold ${a.disponible <= 0 ? "text-red-500" : "text-emerald-600"}`}>
                              Dispo&nbsp;: {fmt(a.disponible)} F
                            </span>
                          </div>
                        </div>
                      );
                    })() : (
                      <span className="text-xs text-slate-400 italic">Plafond non défini</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISQUE_STYLE[a.classeRisque] ?? "bg-slate-100 text-slate-600"}`}>
                      Classe {a.classeRisque}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(a.dateDebut)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActif(a.id, a.actif)} className="text-slate-400 hover:text-emerald-600">
                      {a.actif ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditingAffectation(a)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Modifier cette affectation">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onSuccess={refetch} />}

      {editingAffectation && (
        <EditModal
          affectation={editingAffectation}
          onClose={() => setEditingAffectation(null)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}
