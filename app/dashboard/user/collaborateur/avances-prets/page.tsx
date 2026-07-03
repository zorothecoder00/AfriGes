"use client";

import { useState } from "react";
import {
  RefreshCw, CheckCircle, Clock, XCircle, X, Save, Plus, Ban, Info,
  Wallet, Landmark, ChevronRight,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Avance {
  id: number; montant: number; motif: string | null; echeancesMois: number;
  montantRestant: number; statut: string; commentaire: string | null; createdAt: string;
}
interface Pret {
  id: number; montant: number; motif: string | null; dureesMois: number;
  tauxInteret: number; montantMensuel: number; montantRestant: number;
  statut: string; commentaire: string | null; createdAt: string;
}
interface Resp<T> { profilRH: { id: number; matricule: string } | null; demandes: T[]; }

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode; etape: string }> = {
  EN_ATTENTE:     { label: "En attente",     badge: "bg-yellow-100 text-yellow-700",   icon: <Clock       className="w-3.5 h-3.5" />, etape: "En attente du manager" },
  VALIDE_MANAGER: { label: "Validé manager", badge: "bg-blue-100 text-blue-700",       icon: <CheckCircle className="w-3.5 h-3.5" />, etape: "En attente de la Direction" },
  APPROUVE:       { label: "Approuvée",      badge: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="w-3.5 h-3.5" />, etape: "Accordée — prélèvement en paie" },
  EN_COURS:       { label: "En cours",       badge: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="w-3.5 h-3.5" />, etape: "Prêt décaissé — remboursement en cours" },
  REMBOURSE:      { label: "Remboursée",     badge: "bg-slate-100 text-slate-500",     icon: <CheckCircle className="w-3.5 h-3.5" />, etape: "Soldée" },
  SOLDE:          { label: "Soldé",          badge: "bg-slate-100 text-slate-500",     icon: <CheckCircle className="w-3.5 h-3.5" />, etape: "Soldé" },
  EN_DEFAUT:      { label: "En défaut",      badge: "bg-red-100 text-red-700",         icon: <XCircle     className="w-3.5 h-3.5" />, etape: "En défaut de paiement" },
  REJETE:         { label: "Refusée",        badge: "bg-red-100 text-red-700",         icon: <XCircle     className="w-3.5 h-3.5" />, etape: "Demande refusée" },
  ANNULE:         { label: "Annulée",        badge: "bg-slate-100 text-slate-500",     icon: <Ban         className="w-3.5 h-3.5" />, etape: "Annulée" },
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AvancesPretsPage() {
  const [tab, setTab] = useState<"avances" | "prets">("avances");

  const avances = useApi<Resp<Avance>>("/api/collaborateur/avances");
  const prets   = useApi<Resp<Pret>>("/api/collaborateur/prets");

  const loading  = (avances.loading && !avances.data) || (prets.loading && !prets.data);
  const profilRH = avances.data?.profilRH ?? prets.data?.profilRH ?? null;
  const hasData  = !!(avances.data || prets.data);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  if (hasData && profilRH === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center">
          <Info className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-slate-900">Aucun dossier RH</h1>
          <p className="text-sm text-slate-500 mt-2">
            Votre compte n&apos;est pas rattaché à un dossier RH. Contactez le Responsable RH
            pour pouvoir soumettre des demandes d&apos;avance ou de prêt.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">

        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Avances &amp; Prêts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Soumettez et suivez vos demandes
            {profilRH && <span className="font-mono text-slate-400"> · {profilRH.matricule}</span>}
          </p>
        </div>

        {/* Circuit de validation */}
        <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800 flex-wrap">
          <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span className="font-medium">Circuit :</span>
          <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-100">Vous</span>
          <ChevronRight className="w-3 h-3" />
          <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-100">Manager</span>
          <ChevronRight className="w-3 h-3" />
          <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-100">RH</span>
          <ChevronRight className="w-3 h-3" />
          <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-100">Direction</span>
        </div>

        {/* Onglets */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          <TabButton active={tab === "avances"} onClick={() => setTab("avances")} icon={<Wallet className="w-4 h-4" />}>
            Avances sur salaire
          </TabButton>
          <TabButton active={tab === "prets"} onClick={() => setTab("prets")} icon={<Landmark className="w-4 h-4" />}>
            Prêts
          </TabButton>
        </div>

        {tab === "avances"
          ? <AvancesSection data={avances.data?.demandes ?? []} refetch={avances.refetch} />
          : <PretsSection   data={prets.data?.demandes   ?? []} refetch={prets.refetch} />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {icon}{children}
    </button>
  );
}

// ── Section Avances ──────────────────────────────────────────────────────────────

function AvancesSection({ data, refetch }: { data: Avance[]; refetch: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Mes demandes d&apos;avance</h2>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Nouvelle avance
        </button>
      </div>

      {data.length === 0 ? (
        <EmptyState label="Aucune demande d'avance" onCreate={() => setShowCreate(true)} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {data.map((a) => (
            <DemandeRow
              key={a.id}
              endpoint={`/api/collaborateur/avances/${a.id}`}
              statut={a.statut}
              titre={fmt(a.montant)}
              sousTitre={`${a.echeancesMois} mois${a.montantRestant < a.montant ? ` · reste ${fmt(a.montantRestant)}` : ""}`}
              motif={a.motif}
              commentaire={a.commentaire}
              createdAt={a.createdAt}
              icon={<Wallet className="w-4 h-4" />}
              onRefetch={refetch}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateAvanceModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />
      )}
    </div>
  );
}

// ── Section Prêts ────────────────────────────────────────────────────────────────

function PretsSection({ data, refetch }: { data: Pret[]; refetch: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Mes demandes de prêt</h2>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Nouveau prêt
        </button>
      </div>

      {data.length === 0 ? (
        <EmptyState label="Aucune demande de prêt" onCreate={() => setShowCreate(true)} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {data.map((p) => (
            <DemandeRow
              key={p.id}
              endpoint={`/api/collaborateur/prets/${p.id}`}
              statut={p.statut}
              titre={fmt(p.montant)}
              sousTitre={`${p.dureesMois} mois · mensualité ${fmt(p.montantMensuel)}${p.montantRestant < p.montant ? ` · reste ${fmt(p.montantRestant)}` : ""}`}
              motif={p.motif}
              commentaire={p.commentaire}
              createdAt={p.createdAt}
              icon={<Landmark className="w-4 h-4" />}
              onRefetch={refetch}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePretModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />
      )}
    </div>
  );
}

// ── Ligne générique ──────────────────────────────────────────────────────────────

function DemandeRow({ endpoint, statut, titre, sousTitre, motif, commentaire, createdAt, icon, onRefetch }: {
  endpoint: string; statut: string; titre: string; sousTitre: string;
  motif: string | null; commentaire: string | null; createdAt: string;
  icon: React.ReactNode; onRefetch: () => void;
}) {
  const { mutate, loading } = useMutation(endpoint, "PATCH");
  const cfg = STATUT_CONFIG[statut] ?? STATUT_CONFIG.EN_ATTENTE;
  const annulable = ["EN_ATTENTE", "VALIDE_MANAGER"].includes(statut);

  const handleAnnuler = async () => {
    if (!confirm("Annuler cette demande ?")) return;
    const r = await mutate({ action: "ANNULER" });
    if (r) { toast.success("Demande annulée"); onRefetch(); }
  };

  return (
    <div className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50">
      <span className="p-2 rounded-lg flex-shrink-0 text-emerald-600 bg-emerald-50">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">{titre}</span>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-500">
              <span>{sousTitre}</span>
              <span className="text-slate-400">· {formatDate(createdAt)}</span>
              <span className="text-slate-400 italic">{cfg.etape}</span>
            </div>
            {motif && <p className="mt-1 text-xs text-slate-500 italic">« {motif} »</p>}
            {commentaire && statut === "REJETE" && (
              <p className="mt-1.5 text-xs text-red-600 italic">Motif du refus : {commentaire}</p>
            )}
          </div>
          {annulable && (
            <button onClick={handleAnnuler} disabled={loading}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50">
              Annuler
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label, onCreate }: { label: string; onCreate: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
      <Wallet className="w-10 h-10 mb-2 opacity-30" />
      <p className="text-sm">{label}</p>
      <button onClick={onCreate} className="mt-3 text-xs font-medium text-emerald-600 hover:underline">
        Créer ma première demande
      </button>
    </div>
  );
}

// ── Modal création avance ────────────────────────────────────────────────────────

function CreateAvanceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/collaborateur/avances", "POST");
  const [form, setForm] = useState({ montant: "", echeancesMois: "1", motif: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.montant || Number(form.montant) <= 0) { toast.error("Le montant est obligatoire"); return; }
    const r = await mutate({
      montant:       Number(form.montant),
      echeancesMois: form.echeancesMois ? Number(form.echeancesMois) : 1,
      motif:         form.motif || null,
    });
    if (r) { toast.success("Demande soumise ✓"); onCreated(); }
  };

  return (
    <ModalShell title="Nouvelle demande d'avance" onClose={onClose} loading={loading} onSubmit={handleSubmit}>
      <Field label="Montant (FCFA) *">
        <input type="number" min="0" step="500" value={form.montant} onChange={(e) => set("montant", e.target.value)}
          placeholder="ex. 50000" className={inputCls} />
      </Field>
      <Field label="Remboursement sur (mois) *">
        <input type="number" min="1" step="1" value={form.echeancesMois} onChange={(e) => set("echeancesMois", e.target.value)}
          className={inputCls} />
      </Field>
      <Field label="Motif">
        <textarea value={form.motif} onChange={(e) => set("motif", e.target.value)} rows={2}
          placeholder="Optionnel — précisez si nécessaire" className={`${inputCls} resize-none`} />
      </Field>
    </ModalShell>
  );
}

// ── Modal création prêt ──────────────────────────────────────────────────────────

function CreatePretModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/collaborateur/prets", "POST");
  const [form, setForm] = useState({ montant: "", dureesMois: "12", motif: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mensualite = form.montant && form.dureesMois && Number(form.dureesMois) > 0
    ? Math.ceil(Number(form.montant) / Number(form.dureesMois)) : null;

  const handleSubmit = async () => {
    if (!form.montant || Number(form.montant) <= 0) { toast.error("Le montant est obligatoire"); return; }
    if (!form.dureesMois || Number(form.dureesMois) <= 0) { toast.error("La durée est obligatoire"); return; }
    const r = await mutate({
      montant:    Number(form.montant),
      dureesMois: Number(form.dureesMois),
      motif:      form.motif || null,
    });
    if (r) { toast.success("Demande soumise ✓"); onCreated(); }
  };

  return (
    <ModalShell title="Nouvelle demande de prêt" onClose={onClose} loading={loading} onSubmit={handleSubmit}>
      <Field label="Montant (FCFA) *">
        <input type="number" min="0" step="1000" value={form.montant} onChange={(e) => set("montant", e.target.value)}
          placeholder="ex. 300000" className={inputCls} />
      </Field>
      <Field label="Durée souhaitée (mois) *">
        <input type="number" min="1" step="1" value={form.dureesMois} onChange={(e) => set("dureesMois", e.target.value)}
          className={inputCls} />
      </Field>
      {mensualite && (
        <p className="text-xs text-slate-500 -mt-1">
          Mensualité indicative (hors intérêts) : <strong className="text-slate-700">{fmt(mensualite)}</strong>.
          Le taux et l&apos;échéancier définitifs sont fixés par la Direction à l&apos;approbation.
        </p>
      )}
      <Field label="Motif">
        <textarea value={form.motif} onChange={(e) => set("motif", e.target.value)} rows={2}
          placeholder="Objet du prêt" className={`${inputCls} resize-none`} />
      </Field>
    </ModalShell>
  );
}

// ── Helpers UI ──────────────────────────────────────────────────────────────────

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

function ModalShell({ title, onClose, onSubmit, loading, children }: {
  title: string; onClose: () => void; onSubmit: () => void; loading: boolean; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
            Annuler
          </button>
          <button onClick={onSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Soumettre
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
