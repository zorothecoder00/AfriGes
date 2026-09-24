"use client";

import SortieCaissePicker from "@/components/SortieCaissePicker";
import type { OperationCaisseDispo } from "@/components/FicheDecaissementModal";
import { Suspense, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import RetourApprovisionnement from "@/components/RetourApprovisionnement";
import {
  Archive, X, RefreshCw, CheckCircle, Ban, Plus, Trash2, Package, TrendingUp,
  Wallet, FileText, Truck, PauseCircle, PlayCircle, StopCircle,
} from "lucide-react";

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
const fmt = (n: number) => n.toLocaleString("fr-FR");

// ── Types ────────────────────────────────────────────────────────────────────

interface Convention {
  id: number; reference: string; statut: "ACTIVE" | "SUSPENDUE" | "TERMINEE";
  commissionPourcent: string | number; dateDebut: string; dateFin: string | null;
  conditions: string | null;
  fournisseur: { id: number; nom: string; code: string | null; telephone: string | null };
  creePar: { id: number; nom: string; prenom: string };
  depots: { id: number; reference: string; statut: string }[];
  reglements: { id: number; reference: string; statut: string; montantDu: string | number }[];
}

interface LigneDepot {
  id: number; produitId: number; quantiteDeposee: number; prixVenteConvenu: string | number;
  quantiteReprise: number; dlc: string | null; lotProduitId: number | null;
  produit: { id: number; nom: string; codeProduit: string | null };
  lotProduit?: { id: number; quantite: number; quantiteInitiale: number; statut: string } | null;
}
interface Depot {
  id: number; reference: string; statut: "BROUILLON" | "EN_STOCK" | "CLOTURE";
  dateDepot: string; dateEntree: string | null; createdAt: string;
  convention: { id: number; reference: string; commissionPourcent: string | number; fournisseur: { id: number; nom: string } };
  pointDeVente: { id: number; nom: string; code: string };
  creePar: { id: number; nom: string; prenom: string };
  entreePar: { id: number; nom: string; prenom: string } | null;
  lignes: LigneDepot[];
}

interface EtatConvention {
  conventionId: number; conventionReference: string;
  fournisseur: { id: number; nom: string }; commissionPourcent: number;
  stockEnDepot: EtatLigne[]; ventes: EtatLigne[]; invendus: EtatLigne[];
  synthese: { montantVentesBrut: number; montantCommission: number; montantDu: number };
}
interface EtatLigne {
  depotId: number; depotReference: string; produitId: number; produitNom: string; codeProduit: string | null;
  quantiteDeposee: number; quantiteVendue: number; quantiteRestante: number; quantiteReprise: number;
  prixVenteConvenu: number; montantBrut: number; montantCommission: number; montantNet: number;
}

interface LigneReglement {
  id: number; quantiteVendue: number; montantBrut: string | number; montantCommission: string | number; montantNet: string | number;
  ligneDepot: { produit: { id: number; nom: string }; depot: { id: number; reference: string } };
}
interface Reglement {
  id: number; reference: string; statut: "BROUILLON" | "SOUMIS" | "REGLE";
  periodeDebut: string; periodeFin: string;
  montantVentesBrut: string | number; montantCommission: string | number; montantDu: string | number;
  convention: { id: number; reference: string; fournisseur: { id: number; nom: string } };
  demandePar: { id: number; nom: string; prenom: string };
  decaissements: { id: number; reference: string; statut: string }[];
  lignes: LigneReglement[];
}

const STATUT_CDV: Record<string, { label: string; badge: string }> = {
  ACTIVE: { label: "Active", badge: "bg-emerald-100 text-emerald-700" },
  SUSPENDUE: { label: "Suspendue", badge: "bg-amber-100 text-amber-700" },
  TERMINEE: { label: "Terminée", badge: "bg-slate-200 text-slate-600" },
};
const STATUT_DEP: Record<string, { label: string; badge: string }> = {
  BROUILLON: { label: "Brouillon", badge: "bg-slate-200 text-slate-600" },
  EN_STOCK: { label: "En stock", badge: "bg-emerald-100 text-emerald-700" },
  CLOTURE: { label: "Clôturé", badge: "bg-slate-200 text-slate-600" },
};
const STATUT_RDV: Record<string, { label: string; badge: string }> = {
  BROUILLON: { label: "Brouillon", badge: "bg-slate-200 text-slate-600" },
  SOUMIS: { label: "Soumis", badge: "bg-amber-100 text-amber-700" },
  REGLE: { label: "Réglé", badge: "bg-emerald-100 text-emerald-700" },
};

type Tab = "conventions" | "depots" | "etat" | "reglements";

export default function DepotVentePage() {
  return (
    <Suspense fallback={null}>
      <DepotVentePageInner />
    </Suspense>
  );
}

function DepotVentePageInner() {
  const [tab, setTab] = useState<Tab>("conventions");
  const [showCreateConvention, setShowCreateConvention] = useState(false);
  const [showCreateDepot, setShowCreateDepot] = useState(false);
  const [showCreateReglement, setShowCreateReglement] = useState(false);
  const [detailDepotId, setDetailDepotId] = useState<number | null>(null);
  const [detailReglementId, setDetailReglementId] = useState<number | null>(null);

  const { data: conventionsData, loading: loadingConventions, refetch: refetchConventions } =
    useApi<{ data: Convention[] }>(tab === "conventions" || tab === "depots" || tab === "reglements" ? "/api/logistique/depot-vente/conventions" : null);
  const conventions = conventionsData?.data ?? [];

  const { data: depotsData, loading: loadingDepots, refetch: refetchDepots } =
    useApi<{ data: Depot[]; pdvs: { id: number; nom: string; code: string }[] }>(tab === "depots" ? "/api/logistique/depot-vente/depots" : null);
  const depots = depotsData?.data ?? [];
  const pdvs = depotsData?.pdvs ?? [];

  const { data: etatData, loading: loadingEtat, refetch: refetchEtat } =
    useApi<{ data: EtatConvention[] }>(tab === "etat" ? "/api/logistique/depot-vente/etat" : null);
  const etats = etatData?.data ?? [];

  const { data: reglementsData, loading: loadingReglements, refetch: refetchReglements } =
    useApi<{ data: Reglement[] }>(tab === "reglements" ? "/api/logistique/depot-vente/reglements" : null);
  const reglements = reglementsData?.data ?? [];

  const tabs: { key: Tab; label: string; icon: typeof Archive }[] = [
    { key: "conventions", label: "Conventions", icon: FileText },
    { key: "depots", label: "Dépôts", icon: Package },
    { key: "etat", label: "État & rapport", icon: TrendingUp },
    { key: "reglements", label: "Règlements", icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-[#dbe7f5]">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <RetourApprovisionnement />
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Archive className="w-6 h-6 text-emerald-600" /> Dépôt-vente
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Marchandises déposées par des fournisseurs partenaires, vendues pour leur compte contre commission.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap border-b border-slate-200 pb-3">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "conventions" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowCreateConvention(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">
                <Plus className="w-4 h-4" /> Nouvelle convention
              </button>
            </div>
            {loadingConventions ? (
              <Loading />
            ) : conventions.length === 0 ? (
              <Empty icon={FileText} label="Aucune convention de dépôt-vente" />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {conventions.map((c) => (
                  <ConventionRow key={c.id} c={c} onUpdated={refetchConventions} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "depots" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowCreateDepot(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">
                <Plus className="w-4 h-4" /> Nouveau dépôt
              </button>
            </div>
            {loadingDepots ? (
              <Loading />
            ) : depots.length === 0 ? (
              <Empty icon={Package} label="Aucun dépôt de marchandises" />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {depots.map((d) => {
                  const cfg = STATUT_DEP[d.statut];
                  return (
                    <div key={d.id} onClick={() => setDetailDepotId(d.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{d.reference}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {d.convention.fournisseur.nom} · {d.pointDeVente.nom} · {formatDate(d.createdAt)}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0">{d.lignes.length} produit(s)</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "etat" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={refetchEtat} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
            </div>
            {loadingEtat ? (
              <Loading />
            ) : etats.length === 0 ? (
              <Empty icon={TrendingUp} label="Aucune convention à synthétiser" />
            ) : (
              etats.map((e) => <EtatCard key={e.conventionId} e={e} />)
            )}
          </div>
        )}

        {tab === "reglements" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowCreateReglement(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">
                <Plus className="w-4 h-4" /> Nouveau règlement
              </button>
            </div>
            {loadingReglements ? (
              <Loading />
            ) : reglements.length === 0 ? (
              <Empty icon={Wallet} label="Aucun règlement" />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {reglements.map((r) => {
                  const cfg = STATUT_RDV[r.statut];
                  return (
                    <div key={r.id} onClick={() => setDetailReglementId(r.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{r.reference}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{r.convention.fournisseur.nom} · {formatDate(r.periodeFin)}</p>
                      </div>
                      <span className="text-sm font-bold text-slate-700 flex-shrink-0">{fmt(Number(r.montantDu))} FCFA</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateConvention && (
        <CreateConventionModal onClose={() => setShowCreateConvention(false)} onCreated={() => { setShowCreateConvention(false); refetchConventions(); }} />
      )}
      {showCreateDepot && (
        <CreateDepotModal conventions={conventions.filter((c) => c.statut === "ACTIVE")} pdvs={pdvs} onClose={() => setShowCreateDepot(false)}
          onCreated={(id) => { setShowCreateDepot(false); refetchDepots(); setDetailDepotId(id); }} />
      )}
      {showCreateReglement && (
        <CreateReglementModal conventions={conventions} onClose={() => setShowCreateReglement(false)}
          onCreated={(id) => { setShowCreateReglement(false); refetchReglements(); setDetailReglementId(id); }} />
      )}
      {detailDepotId && (
        <DepotDetail id={detailDepotId} onClose={() => setDetailDepotId(null)} onUpdated={refetchDepots} />
      )}
      {detailReglementId && (
        <ReglementDetail id={detailReglementId} onClose={() => setDetailReglementId(null)} onUpdated={refetchReglements} />
      )}
    </div>
  );
}

function Loading() {
  return <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>;
}
function Empty({ icon: Icon, label }: { icon: typeof Archive; label: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
      <Icon className="w-10 h-10 mb-2 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

// ── Conventions ──────────────────────────────────────────────────────────────

function ConventionRow({ c, onUpdated }: { c: Convention; onUpdated: () => void }) {
  const [busy, setBusy] = useState(false);
  const cfg = STATUT_CDV[c.statut];

  const action = async (action: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/logistique/depot-vente/conventions/${c.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Mis à jour"); onUpdated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">{c.reference}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {c.fournisseur.nom} · Commission {Number(c.commissionPourcent)}% · {c.depots.length} dépôt(s) · {c.reglements.length} règlement(s)
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {c.statut === "ACTIVE" && (
          <button onClick={() => action("SUSPENDRE")} disabled={busy} title="Suspendre" className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg disabled:opacity-50"><PauseCircle className="w-4 h-4" /></button>
        )}
        {c.statut === "SUSPENDUE" && (
          <button onClick={() => action("REACTIVER")} disabled={busy} title="Réactiver" className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg disabled:opacity-50"><PlayCircle className="w-4 h-4" /></button>
        )}
        {c.statut !== "TERMINEE" && (
          <button onClick={() => { if (confirm("Terminer cette convention ?")) action("TERMINER"); }} disabled={busy} title="Terminer" className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg disabled:opacity-50"><StopCircle className="w-4 h-4" /></button>
        )}
      </div>
    </div>
  );
}

function CreateConventionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [fournisseurSearch, setFournisseurSearch] = useState("");
  const [fournisseurId, setFournisseurId] = useState<number | null>(null);
  const [fournisseurNom, setFournisseurNom] = useState("");
  const [commissionPourcent, setCommissionPourcent] = useState("");
  const [dureeMaxInvenduJours, setDureeMaxInvenduJours] = useState("");
  const [conditions, setConditions] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: fournisseursData } = useApi<{ data: { id: number; nom: string; code: string | null }[] }>(
    fournisseurSearch.length >= 2 ? `/api/logistique/fournisseurs?search=${encodeURIComponent(fournisseurSearch)}&limit=10` : null
  );

  const handleSubmit = async () => {
    if (!fournisseurId) { toast.error("Sélectionnez un fournisseur"); return; }
    const commission = Number(commissionPourcent);
    if (!(commission >= 0 && commission <= 100)) { toast.error("Commission (%) invalide"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/logistique/depot-vente/conventions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fournisseurId, commissionPourcent: commission,
          dureeMaxInvenduJours: dureeMaxInvenduJours ? Number(dureeMaxInvenduJours) : undefined,
          conditions: conditions.trim() || undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Convention créée"); onCreated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle convention de dépôt-vente</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fournisseur déposant *</label>
            {fournisseurId ? (
              <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                <span>{fournisseurNom}</span>
                <button onClick={() => { setFournisseurId(null); setFournisseurNom(""); }} className="text-emerald-600 hover:text-emerald-800"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <>
                <input value={fournisseurSearch} onChange={(e) => setFournisseurSearch(e.target.value)} placeholder="Rechercher un fournisseur…" className={inputCls} />
                {fournisseurSearch.length >= 2 && (fournisseursData?.data.length ?? 0) > 0 && (
                  <div className="mt-1 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-32 overflow-y-auto">
                    {fournisseursData!.data.map((f) => (
                      <button key={f.id} onClick={() => { setFournisseurId(f.id); setFournisseurNom(f.nom); setFournisseurSearch(""); }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50">{f.nom}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Commission AfriSime (%) *</label>
            <input type="number" min="0" max="100" step="0.1" value={commissionPourcent} onChange={(e) => setCommissionPourcent(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Durée max avant reprise des invendus (jours, optionnel)</label>
            <input type="number" min="1" value={dureeMaxInvenduJours} onChange={(e) => setDureeMaxInvenduJours(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Conditions</label>
            <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dépôts ───────────────────────────────────────────────────────────────────

interface LigneDepotForm { produitId: number | null; produitNom: string; quantite: string; prixVenteConvenu: string; dlc: string }

function CreateDepotModal({ conventions, pdvs, onClose, onCreated }: { conventions: Convention[]; pdvs: { id: number; nom: string; code: string }[]; onClose: () => void; onCreated: (id: number) => void }) {
  const [conventionId, setConventionId] = useState<number | null>(conventions[0]?.id ?? null);
  const [pointDeVenteId, setPointDeVenteId] = useState<number | null>(null);
  const [lignes, setLignes] = useState<LigneDepotForm[]>([{ produitId: null, produitNom: "", quantite: "", prixVenteConvenu: "", dlc: "" }]);
  const [produitSearch, setProduitSearch] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: produitsData } = useApi<{ data: { id: number; nom: string; codeProduit: string | null }[] }>(
    Object.values(produitSearch).some((s) => s.length >= 2)
      ? `/api/logistique/produits?search=${encodeURIComponent(Object.values(produitSearch).find((s) => s.length >= 2) ?? "")}&limit=10`
      : null
  );

  const updateLigne = (i: number, patch: Partial<LigneDepotForm>) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const handleSubmit = async () => {
    if (!conventionId) { toast.error("Sélectionnez une convention"); return; }
    if (!pointDeVenteId) { toast.error("Sélectionnez un point de vente"); return; }
    const valides = lignes.filter((l) => l.produitId && Number(l.quantite) > 0 && Number(l.prixVenteConvenu) > 0);
    if (!valides.length) { toast.error("Ajoutez au moins une ligne valide (produit, quantité, prix de vente)"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/logistique/depot-vente/depots", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conventionId, pointDeVenteId,
          lignes: valides.map((l) => ({ produitId: l.produitId, quantite: Number(l.quantite), prixVenteConvenu: Number(l.prixVenteConvenu), dlc: l.dlc || undefined })),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Dépôt créé"); onCreated(j.data.id); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle fiche de dépôt</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {conventions.length === 0 ? (
            <p className="text-sm text-amber-600">Aucune convention active — créez-en une d&apos;abord dans l&apos;onglet Conventions.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Convention *</label>
                <select value={conventionId ?? ""} onChange={(e) => setConventionId(Number(e.target.value))} className={inputCls}>
                  {conventions.map((c) => <option key={c.id} value={c.id}>{c.reference} — {c.fournisseur.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Point de vente *</label>
                <select value={pointDeVenteId ?? ""} onChange={(e) => setPointDeVenteId(Number(e.target.value))} className={inputCls}>
                  <option value="">—</option>
                  {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Produits déposés</label>
              <button onClick={() => setLignes((ls) => [...ls, { produitId: null, produitNom: "", quantite: "", prixVenteConvenu: "", dlc: "" }])}
                className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium">
                <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
              </button>
            </div>
            {lignes.map((l, i) => (
              <div key={i} className="border border-slate-100 rounded-lg p-2 space-y-1.5">
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    {l.produitId ? (
                      <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                        <span>{l.produitNom}</span>
                        <button onClick={() => updateLigne(i, { produitId: null, produitNom: "" })} className="text-emerald-600 hover:text-emerald-800"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <>
                        <input value={produitSearch[i] ?? ""} onChange={(e) => setProduitSearch((s) => ({ ...s, [i]: e.target.value }))}
                          placeholder="Rechercher un produit…" className={inputCls} />
                        {(produitSearch[i]?.length ?? 0) >= 2 && (produitsData?.data.length ?? 0) > 0 && (
                          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-32 overflow-y-auto mt-1">
                            {produitsData!.data.map((p) => (
                              <button key={p.id} onClick={() => { updateLigne(i, { produitId: p.id, produitNom: p.nom }); setProduitSearch((s) => ({ ...s, [i]: "" })); }}
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50">{p.nom}</button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {lignes.length > 1 && (
                    <button onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <input type="number" min="1" value={l.quantite} onChange={(e) => updateLigne(i, { quantite: e.target.value })} placeholder="Qté" className={`${inputCls} text-xs`} />
                  <input type="number" min="0" value={l.prixVenteConvenu} onChange={(e) => updateLigne(i, { prixVenteConvenu: e.target.value })} placeholder="Prix vente (FCFA)" className={`${inputCls} text-xs`} />
                  <input type="date" value={l.dlc} onChange={(e) => updateLigne(i, { dlc: e.target.value })} className={`${inputCls} text-xs`} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || conventions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function DepotDetail({ id, onClose, onUpdated }: { id: number; onClose: () => void; onUpdated: () => void }) {
  const { data, loading, refetch } = useApi<{ data: Depot }>(`/api/logistique/depot-vente/depots/${id}`);
  const d = data?.data;
  const [busy, setBusy] = useState(false);
  const [reprises, setReprises] = useState<Record<number, string>>({});

  const constaterEntree = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/logistique/depot-vente/depots/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CONSTATER_ENTREE" }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Entrée en stock constatée"); refetch(); onUpdated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  const repriseInvendus = async () => {
    const lignes = Object.entries(reprises)
      .map(([ligneId, quantite]) => ({ ligneId: Number(ligneId), quantite: Number(quantite) }))
      .filter((l) => l.quantite > 0);
    if (!lignes.length) { toast.error("Saisissez au moins une quantité à reprendre"); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/logistique/depot-vente/depots/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "REPRISE_INVENDUS", lignes }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Invendus repris"); setReprises({}); refetch(); onUpdated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">{d?.reference ?? "Chargement…"}</h2>
            {d && <p className="text-xs text-slate-400">{d.convention.fournisseur.nom} · {d.pointDeVente.nom} · {STATUT_DEP[d.statut]?.label}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {d?.statut === "BROUILLON" && (
              <button onClick={constaterEntree} disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />} Constater l&apos;entrée en stock
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading || !d ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Produit</th>
                    <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs">Déposé</th>
                    <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs">Restant</th>
                    <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs">Repris</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600 text-xs">Prix vente</th>
                    {d.statut === "EN_STOCK" && <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs">Reprendre</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.lignes.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-slate-800">{l.produit.nom}</span>
                        {l.produit.codeProduit && <span className="ml-1.5 text-xs text-slate-400 font-mono">{l.produit.codeProduit}</span>}
                      </td>
                      <td className="text-center px-3 py-2.5">{l.quantiteDeposee}</td>
                      <td className="text-center px-3 py-2.5 font-bold text-slate-800">{l.lotProduit?.quantite ?? "—"}</td>
                      <td className="text-center px-3 py-2.5 text-slate-500">{l.quantiteReprise}</td>
                      <td className="text-right px-3 py-2.5">{fmt(Number(l.prixVenteConvenu))} FCFA</td>
                      {d.statut === "EN_STOCK" && (
                        <td className="text-center px-3 py-2.5">
                          {(l.lotProduit?.quantite ?? 0) > 0 && (
                            <input type="number" min="0" max={l.lotProduit?.quantite ?? 0} value={reprises[l.id] ?? ""}
                              onChange={(e) => setReprises((r) => ({ ...r, [l.id]: e.target.value }))}
                              className="w-16 px-2 py-1 border border-slate-200 rounded text-xs text-center" />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {d?.statut === "EN_STOCK" && (
            <div className="flex justify-end">
              <button onClick={repriseInvendus} disabled={busy}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">
                {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Reprendre les invendus saisis
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── État & rapport ───────────────────────────────────────────────────────────

function EtatCard({ e }: { e: EtatConvention }) {
  const [section, setSection] = useState<"stock" | "ventes" | "invendus">("stock");
  const lignes = section === "stock" ? e.stockEnDepot : section === "ventes" ? e.ventes : e.invendus;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-slate-800">{e.fournisseur.nom}</h3>
          <p className="text-xs text-slate-400">{e.conventionReference} · Commission {e.commissionPourcent}%</p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-right">
            <p className="text-xs text-slate-400">Ventes brutes</p>
            <p className="font-bold text-slate-700">{fmt(e.synthese.montantVentesBrut)} FCFA</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Commission</p>
            <p className="font-bold text-slate-700">{fmt(e.synthese.montantCommission)} FCFA</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Dû au fournisseur</p>
            <p className="font-bold text-emerald-600">{fmt(e.synthese.montantDu)} FCFA</p>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        {([["stock", `Stock en dépôt (${e.stockEnDepot.length})`], ["ventes", `Ventes (${e.ventes.length})`], ["invendus", `Invendus (${e.invendus.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setSection(k)}
            className={`px-3 py-1 rounded-lg text-xs font-medium ${section === k ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {label}
          </button>
        ))}
      </div>
      {lignes.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">Aucune ligne</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="border-b border-slate-200">
            <tr className="text-slate-400">
              <th className="text-left py-1.5">Produit</th>
              <th className="text-center py-1.5">Déposé</th>
              <th className="text-center py-1.5">Vendu</th>
              <th className="text-center py-1.5">Restant</th>
              <th className="text-right py-1.5">Montant net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {lignes.map((l, i) => (
              <tr key={`${l.depotId}-${l.produitId}-${i}`}>
                <td className="py-1.5 text-slate-700">{l.produitNom}</td>
                <td className="text-center py-1.5">{l.quantiteDeposee}</td>
                <td className="text-center py-1.5">{l.quantiteVendue}</td>
                <td className="text-center py-1.5">{l.quantiteRestante}</td>
                <td className="text-right py-1.5 font-medium">{fmt(l.montantNet)} FCFA</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Règlements ───────────────────────────────────────────────────────────────

function CreateReglementModal({ conventions, onClose, onCreated }: { conventions: Convention[]; onClose: () => void; onCreated: (id: number) => void }) {
  const [conventionId, setConventionId] = useState<number | null>(conventions[0]?.id ?? null);
  const [periodeDebut, setPeriodeDebut] = useState("");
  const [periodeFin, setPeriodeFin] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!conventionId) { toast.error("Sélectionnez une convention"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/logistique/depot-vente/reglements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conventionId, periodeDebut: periodeDebut || undefined, periodeFin: periodeFin || undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Règlement calculé"); onCreated(j.data.id); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle demande de règlement</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Convention *</label>
            <select value={conventionId ?? ""} onChange={(e) => setConventionId(Number(e.target.value))} className={inputCls}>
              {conventions.map((c) => <option key={c.id} value={c.id}>{c.reference} — {c.fournisseur.nom}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Période — début</label>
              <input type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Période — fin</label>
              <input type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} className={inputCls} />
            </div>
          </div>
          <p className="text-xs text-slate-400">Le montant est calculé automatiquement à partir des ventes non encore réglées sur cette convention.</p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || conventions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Calculer
          </button>
        </div>
      </div>
    </div>
  );
}

function ReglementDetail({ id, onClose, onUpdated }: { id: number; onClose: () => void; onUpdated: () => void }) {
  const { data, loading, refetch } = useApi<{ data: Reglement }>(`/api/logistique/depot-vente/reglements/${id}`);
  const r = data?.data;
  const [busy, setBusy] = useState(false);
  // La fiche vient après la sortie de caisse : on rattache la sortie « Fournisseur » déjà faite
  const [sortie, setSortie] = useState<OperationCaisseDispo | null>(null);

  const soumettre = async () => {
    if (!sortie) { toast.error("Sélectionnez la sortie de caisse du règlement"); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/logistique/depot-vente/reglements/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SOUMETTRE",
          ...(sortie.source === "CAISSE" ? { operationCaisseId: sortie.id } : { operationCaissePDVId: sortie.id }),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { toast.success(`Fiche de décaissement ${j.data?.reference ?? ""} créée — soumise au contrôle`); setSortie(null); refetch(); onUpdated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">{r?.reference ?? "Chargement…"}</h2>
            {r && <p className="text-xs text-slate-400">{r.convention.fournisseur.nom} · {STATUT_RDV[r.statut]?.label}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading || !r ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400">Ventes brutes</p>
                  <p className="font-bold text-slate-700">{fmt(Number(r.montantVentesBrut))}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400">Commission</p>
                  <p className="font-bold text-slate-700">{fmt(Number(r.montantCommission))}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-emerald-600">Montant dû</p>
                  <p className="font-bold text-emerald-700">{fmt(Number(r.montantDu))}</p>
                </div>
              </div>
              {r.statut === "BROUILLON" && (
                <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600 uppercase">Règlement en caisse</p>
                  <p className="text-xs text-slate-500">
                    Le règlement est d&apos;abord effectué en caisse (sortie « Fournisseur » de {fmt(Number(r.montantDu))} FCFA) ; rattachez cette sortie pour créer la fiche de décaissement soumise au contrôle.
                  </p>
                  <SortieCaissePicker value={sortie} onChange={setSortie} categorie="FOURNISSEUR" montantAttendu={Number(r.montantDu)}
                    vide="Aucune sortie de caisse « Fournisseur » sans fiche. Faites d&apos;abord enregistrer le règlement en caisse." />
                  <button onClick={soumettre} disabled={busy || !sortie}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                    {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Rattacher la sortie et créer la fiche
                  </button>
                </div>
              )}
              {r.decaissements.length > 0 && (
                <div className="text-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Fiche de décaissement</p>
                  {r.decaissements.map((f) => (
                    <a key={f.id} href={`/dashboard/user/decaissements?detail=${f.id}`} className="text-emerald-600 hover:text-emerald-700 underline text-sm">
                      {f.reference} ({f.statut})
                    </a>
                  ))}
                </div>
              )}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Produit</th>
                      <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs">Qté</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600 text-xs">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.lignes.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2.5">{l.ligneDepot.produit.nom} <span className="text-xs text-slate-400">({l.ligneDepot.depot.reference})</span></td>
                        <td className="text-center px-3 py-2.5">{l.quantiteVendue}</td>
                        <td className="text-right px-3 py-2.5 font-medium">{fmt(Number(l.montantNet))} FCFA</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
