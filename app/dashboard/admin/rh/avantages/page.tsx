"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Plus, Save,
  CheckCircle, Clock, XCircle, CreditCard,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";

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

const STATUT_REMB: Record<string, { label: string; variant: BadgeVariant; icon: React.ReactNode }> = {
  EN_ATTENTE: { label: "En attente", variant: "warning", icon: <Clock       className="w-3.5 h-3.5" /> },
  APPROUVE:   { label: "Approuvé",   variant: "info",    icon: <CheckCircle className="w-3.5 h-3.5" /> },
  REJETE:     { label: "Rejeté",     variant: "error",   icon: <XCircle     className="w-3.5 h-3.5" /> },
  PAYE:       { label: "Payé",       variant: "success", icon: <CreditCard  className="w-3.5 h-3.5" /> },
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const selectCls = "w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500";

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AvantagesPage() {
  const [tab, setTab] = useState<"avantages" | "remboursements">("avantages");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Avantages & Remboursements</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Avantages en nature et remboursements de frais</p>
        </div>
        {/* Onglets */}
        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-1">
            {(["avantages", "remboursements"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t ? "border-primary-500 text-primary-600 dark:text-primary-400" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}>
                {t === "avantages" ? <><DollarSign className="w-4 h-4" /> Avantages</> : <><CreditCard className="w-4 h-4" /> Remboursements</>}
              </button>
            ))}
          </div>
        </div>

        {tab === "avantages"       && <AvantagesTab />}
        {tab === "remboursements"  && <RemboursementsTab />}
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
          <Input value={search} onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher…"
            icon={<Search className="w-4 h-4" />} />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="border border-slate-200 dark:border-slate-700" title="Rafraîchir" />
          <Button onClick={() => setShowCreate(true)} icon={<Plus className="w-4 h-4" />}>
            Nouvel avantage
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
          <DollarSign className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucun avantage enregistré</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
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
    <div className={`flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 group ${!a.actif ? "opacity-60" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/dashboard/admin/rh/collaborateurs/${a.profilRH.id}`}
            className="text-sm font-semibold text-slate-800 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400">
            {m.prenom} {m.nom}
          </Link>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{a.profilRH.matricule}</span>
          <Badge variant="neutral">{TYPE_AVANTAGE[a.type] ?? a.type}</Badge>
          {!a.actif && <Badge variant="neutral">Inactif</Badge>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
          <span>{a.libelle}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt(a.montantMensuel)} FCFA/mois</span>
          <span>Depuis {formatDate(a.dateDebut)}{a.dateFin ? ` → ${formatDate(a.dateFin)}` : ""}</span>
        </div>
      </div>
      <button onClick={toggle} disabled={loading}
        className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-opacity ${
          a.actif
            ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
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
            className={`p-4 rounded-2xl border text-left transition-all ${statut === key ? "border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-400 dark:ring-primary-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"}`}>
            <div className="mb-1"><Badge variant={cfg.variant} icon={cfg.icon}>{cfg.label}</Badge></div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{stats[key] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Input value={search} onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher…"
            icon={<Search className="w-4 h-4" />} />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="border border-slate-200 dark:border-slate-700" title="Rafraîchir" />
          <Button onClick={() => setShowCreate(true)} icon={<Plus className="w-4 h-4" />}>
            Nouveau remboursement
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : rembs.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
          <CreditCard className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucun remboursement trouvé</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {rembs.map((r) => <RembRow key={r.id} remb={r} onRefetch={refetch} />)}
          </div>
        </div>
      )}

      {meta && (
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} itemLabel="remboursement(s)" />
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
    <div className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/dashboard/admin/rh/collaborateurs/${r.profilRH.id}`}
            className="text-sm font-semibold text-slate-800 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400">{m.prenom} {m.nom}</Link>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{r.profilRH.matricule}</span>
          <Badge variant={cfg.variant} icon={cfg.icon}>{cfg.label}</Badge>
          <Badge variant="neutral">{TYPE_REMB[r.type] ?? r.type}</Badge>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
          <span>{r.libelle}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt(r.montant)} FCFA</span>
          <span>{formatDate(r.dateFrais)}</span>
        </div>
        {r.commentaire && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{r.commentaire}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {r.statut === "EN_ATTENTE" && (
          <>
            <Button size="sm" variant="secondary" onClick={() => doAction("APPROUVER")} disabled={loading} icon={<CheckCircle className="w-3.5 h-3.5" />}
              className="!text-primary-700 dark:!text-primary-300">
              Approuver
            </Button>
            <Button size="sm" variant="danger" onClick={() => doAction("REJETER")} disabled={loading} icon={<XCircle className="w-3.5 h-3.5" />}>
              Rejeter
            </Button>
          </>
        )}
        {r.statut === "APPROUVE" && (
          <Button size="sm" variant="success" onClick={() => doAction("MARQUER_PAYE")} disabled={loading} icon={<CreditCard className="w-3.5 h-3.5" />}>
            Marquer payé
          </Button>
        )}
        {r.justificatif && (
          <a href={r.justificatif} target="_blank" rel="noreferrer"
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600">
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
    <Modal open onClose={onClose} title="Nouvel avantage en nature" size="sm">
        <div className="space-y-4">
          <AField label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className={selectCls}>
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
            </select>
          </AField>
          <div className="grid grid-cols-2 gap-3">
            <AField label="Type *">
              <select value={form.type} onChange={(e) => { set("type", e.target.value); if (!form.libelle) setForm((f) => ({ ...f, libelle: TYPE_AVANTAGE[e.target.value] ?? "" })); }}
                className={selectCls}>
                <option value="">—</option>
                {Object.entries(TYPE_AVANTAGE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </AField>
            <Input label="Montant mensuel" type="number" value={form.montantMensuel} onChange={(e) => set("montantMensuel", e.target.value)} placeholder="0" />
          </div>
          <Input label="Libellé *" value={form.libelle} onChange={(e) => set("libelle", e.target.value)} placeholder="Description de l'avantage" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date de début *" type="date" value={form.dateDebut} onChange={(e) => set("dateDebut", e.target.value)} />
            <Input label="Date de fin" type="date" value={form.dateFin} onChange={(e) => set("dateFin", e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-700">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={loading} loading={loading} icon={<Save className="w-4 h-4" />}>Créer</Button>
        </div>
    </Modal>
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
    <Modal open onClose={onClose} title="Nouvelle demande de remboursement" size="sm">
        <div className="space-y-4">
          <AField label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className={selectCls}>
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
            </select>
          </AField>
          <div className="grid grid-cols-2 gap-3">
            <AField label="Type *">
              <select value={form.type} onChange={(e) => { set("type", e.target.value); if (!form.libelle) setForm((f) => ({ ...f, libelle: TYPE_REMB[e.target.value] ?? "" })); }}
                className={selectCls}>
                <option value="">—</option>
                {Object.entries(TYPE_REMB).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </AField>
            <Input label="Montant *" type="number" value={form.montant} onChange={(e) => set("montant", e.target.value)} placeholder="0" />
          </div>
          <Input label="Libellé *" value={form.libelle} onChange={(e) => set("libelle", e.target.value)} />
          <Input label="Date des frais *" type="date" value={form.dateFrais} onChange={(e) => set("dateFrais", e.target.value)} />
          <Input label="Justificatif (URL)" value={form.justificatif} onChange={(e) => set("justificatif", e.target.value)} placeholder="https://…" />
        </div>
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-700">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={loading} loading={loading} icon={<Save className="w-4 h-4" />}>Créer</Button>
        </div>
    </Modal>
  );
}

function AField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
