"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardCheck, RefreshCw, Clock, CheckCircle2, XCircle, ScanLine, AlertTriangle, Search, Eye,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDateTime } from "@/lib/format";
import Button from "@/components/ui/Button";
import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import KpiCard from "@/components/ui/KpiCard";
import Pagination from "@/components/ui/Pagination";

/**
 * Validation admin des inventaires physiques soumis par les magasiniers/RPV :
 * contrôle des écarts (valorisés, et stock actuel vs stock figé au démarrage),
 * puis VALIDER (écarts appliqués au stock) ou REJETER (retour en recomptage).
 */

type Statut = "EN_COURS" | "SOUMIS" | "VALIDE" | "ANNULE";
type Personne = { id: number; nom: string; prenom: string } | null;

interface InventaireRow {
  id: number; reference: string; statut: Statut; createdAt: string;
  dateSoumission: string | null; dateValidation: string | null; commentaireValidation: string | null;
  pointDeVente: { id: number; nom: string; code: string };
  realisePar: Personne; validePar: Personne;
  _count: { lignes: number };
  nbEcarts: number;
}

interface ListeResponse {
  data: InventaireRow[];
  stats: Record<Statut, number>;
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface LigneDetail {
  id: number; produitId: number; quantiteSysteme: number; quantiteConstatee: number; ecart: number;
  stockActuel: number; quantiteReservee: number; stockApresValidation: number;
  produit: { nom: string; reference: string | null; unite: string | null; prixUnitaire: string; prixAchat: string | null };
}

interface InventaireDetail extends Omit<InventaireRow, "_count" | "nbEcarts"> {
  notes: string | null;
  lignes: LigneDetail[];
  stats: {
    nbLignes: number; nbEcarts: number; nbSurplus: number; nbManquants: number; nbStockModifie: number;
    valeurEcart: number; valeurSurplus: number; valeurManquants: number;
  };
}

const STATUT_META: Record<Statut, { variant: BadgeVariant; label: string }> = {
  EN_COURS: { variant: "info",    label: "Comptage en cours" },
  SOUMIS:   { variant: "warning", label: "À valider" },
  VALIDE:   { variant: "success", label: "Validé" },
  ANNULE:   { variant: "neutral", label: "Annulé" },
};

const FILTRES: { key: Statut | ""; label: string }[] = [
  { key: "SOUMIS",   label: "À valider" },
  { key: "EN_COURS", label: "En cours" },
  { key: "VALIDE",   label: "Validés" },
  { key: "ANNULE",   label: "Annulés" },
  { key: "",         label: "Tous" },
];

export default function InventairesAdminPage() {
  return (
    <Suspense fallback={null}>
      <InventairesAdminInner />
    </Suspense>
  );
}

function InventairesAdminInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailId = Number(searchParams.get("detail") || 0) || null;
  const setDetail = (id: number | null) =>
    router.replace(id ? `/dashboard/admin/stock/inventaires?detail=${id}` : "/dashboard/admin/stock/inventaires", { scroll: false });

  const [statut, setStatut] = useState<Statut | "">("SOUMIS");
  const [pdvId, setPdvId] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (statut) params.set("statut", statut);
  if (pdvId) params.set("pointDeVenteId", pdvId);

  const { data, loading, error, refetch } = useApi<ListeResponse>(`/api/admin/stock/inventaires?${params}`);
  const { data: pdvData } = useApi<{ data: { id: number; nom: string }[] }>("/api/admin/pdv?actif=true&limit=100");

  const inventaires = data?.data ?? [];
  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-[#dbe7f5]">
      <div className="md:p-6 space-y-6 max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="text-primary-600" size={24} /> Inventaires physiques
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Validation des comptages soumis par les magasiniers — les écarts ne sont appliqués au stock qu&apos;après votre validation
            </p>
          </div>
          <Button variant="secondary" icon={<RefreshCw className={loading ? "animate-spin" : ""} size={16} />} onClick={refetch}>
            Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="À valider" value={stats?.SOUMIS ?? 0} icon={<Clock size={18} />} accent="warning" />
          <KpiCard label="Comptages en cours" value={stats?.EN_COURS ?? 0} icon={<ScanLine size={18} />} accent="primary" />
          <KpiCard label="Validés" value={stats?.VALIDE ?? 0} icon={<CheckCircle2 size={18} />} accent="success" />
          <KpiCard label="Annulés" value={stats?.ANNULE ?? 0} icon={<XCircle size={18} />} accent="neutral" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1.5 flex-wrap">
              {FILTRES.map(f => (
                <button key={f.key || "ALL"} onClick={() => { setStatut(f.key); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statut === f.key ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}>
                  {f.label}
                  {f.key === "SOUMIS" && !!stats?.SOUMIS && (
                    <span className={`ml-1.5 text-xs px-1.5 rounded-full ${statut === "SOUMIS" ? "bg-white/25" : "bg-amber-500 text-white"}`}>{stats.SOUMIS}</span>
                  )}
                </button>
              ))}
            </div>
            <select value={pdvId} onChange={e => { setPdvId(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
              <option value="">Tous les points de vente</option>
              {(pdvData?.data ?? []).map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>

          {error && <p className="p-4 text-sm text-red-600">{error}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Référence</th>
                  <th className="text-left px-4 py-3 font-medium">Point de vente</th>
                  <th className="text-left px-4 py-3 font-medium">Réalisé par</th>
                  <th className="text-left px-4 py-3 font-medium">Soumis le</th>
                  <th className="text-center px-4 py-3 font-medium">Produits</th>
                  <th className="text-center px-4 py-3 font-medium">Écarts</th>
                  <th className="text-left px-4 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && !data && (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">Chargement…</td></tr>
                )}
                {!loading && inventaires.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">Aucun inventaire.</td></tr>
                )}
                {inventaires.map(i => (
                  <tr key={i.id} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => setDetail(i.id)}>
                    <td className="px-5 py-3 font-mono font-semibold text-slate-800">{i.reference}</td>
                    <td className="px-4 py-3 text-slate-700">{i.pointDeVente.nom}</td>
                    <td className="px-4 py-3 text-slate-600">{i.realisePar ? `${i.realisePar.prenom} ${i.realisePar.nom}` : "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{i.dateSoumission ? formatDateTime(i.dateSoumission) : "—"}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{i._count.lignes}</td>
                    <td className={`px-4 py-3 text-center font-semibold ${i.nbEcarts ? "text-amber-600" : "text-slate-400"}`}>{i.nbEcarts}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUT_META[i.statut].variant}>{STATUT_META[i.statut].label}</Badge>
                      {i.statut === "EN_COURS" && i.commentaireValidation && <Badge variant="error" className="ml-1">Rejeté</Badge>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant={i.statut === "SOUMIS" ? "primary" : "ghost"} icon={<Eye size={14} />}
                        onClick={e => { e.stopPropagation(); setDetail(i.id); }}>
                        {i.statut === "SOUMIS" ? "Examiner" : "Voir"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data?.meta && data.meta.totalPages > 1 && (
            <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} itemLabel="inventaires" />
          )}
        </div>
      </div>

      {detailId && (
        <DetailModal id={detailId} onClose={() => setDetail(null)} onDone={() => { setDetail(null); refetch(); }} />
      )}
    </div>
  );
}

// ─── Détail + validation ─────────────────────────────────────────────────────

function DetailModal({ id, onClose, onDone }: { id: number; onClose: () => void; onDone: () => void }) {
  const { data, loading, error } = useApi<{ data: InventaireDetail }>(`/api/admin/stock/inventaires/${id}`);
  const inv = data?.data;

  const [search, setSearch] = useState("");
  const [ecartsSeuls, setEcartsSeuls] = useState(true);
  const [mode, setMode] = useState<null | "VALIDER" | "REJETER">(null);
  const [commentaire, setCommentaire] = useState("");
  const [busy, setBusy] = useState(false);

  async function agir(action: "VALIDER" | "REJETER") {
    if (action === "REJETER" && !commentaire.trim()) { toast.error("Indiquez le motif du rejet"); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/stock/inventaires/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, commentaire: commentaire.trim() || null }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(action === "VALIDER" ? "Inventaire validé — écarts appliqués au stock" : "Inventaire renvoyé pour recomptage");
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setBusy(false); }
  }

  const lignes = (inv?.lignes ?? []).filter(l => {
    if (ecartsSeuls && l.ecart === 0) return false;
    if (search && !`${l.produit.nom} ${l.produit.reference ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const bloquantes = (inv?.lignes ?? []).filter(l => l.ecart !== 0 && (l.stockApresValidation < 0 || l.stockApresValidation < l.quantiteReservee));

  return (
    <Modal open onClose={onClose} size="lg" title={inv ? `Inventaire ${inv.reference}` : "Inventaire"}>
      {loading && !inv && <p className="text-sm text-slate-400">Chargement…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {inv && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="text-sm text-slate-600 space-y-0.5">
              <p><span className="text-slate-400">Point de vente :</span> <strong className="text-slate-800">{inv.pointDeVente.nom}</strong></p>
              <p><span className="text-slate-400">Réalisé par :</span> {inv.realisePar ? `${inv.realisePar.prenom} ${inv.realisePar.nom}` : "—"} — démarré le {formatDateTime(inv.createdAt)}</p>
              {inv.dateSoumission && <p><span className="text-slate-400">Soumis le :</span> {formatDateTime(inv.dateSoumission)}</p>}
              {inv.statut === "VALIDE" && inv.validePar && (
                <p><span className="text-slate-400">Validé par :</span> {inv.validePar.prenom} {inv.validePar.nom} le {formatDateTime(inv.dateValidation)}</p>
              )}
              {inv.notes && <p className="italic text-slate-500">{inv.notes}</p>}
              {inv.commentaireValidation && <p><span className="text-slate-400">Commentaire admin :</span> {inv.commentaireValidation}</p>}
            </div>
            <Badge variant={STATUT_META[inv.statut].variant} bordered>{STATUT_META[inv.statut].label}</Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <MiniStat label="Produits comptés" value={String(inv.stats.nbLignes)} />
            <MiniStat label="Écarts" value={`${inv.stats.nbEcarts} (${inv.stats.nbSurplus}+ / ${inv.stats.nbManquants}−)`} />
            <MiniStat label="Manquants" value={formatCurrency(inv.stats.valeurManquants)} tone="red" />
            <MiniStat label="Écart net" value={formatCurrency(inv.stats.valeurEcart)} tone={inv.stats.valeurEcart < 0 ? "red" : "emerald"} />
          </div>

          {inv.statut === "SOUMIS" && inv.stats.nbStockModifie > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <p>
                Le stock de {inv.stats.nbStockModifie} produit(s) a bougé depuis le démarrage du comptage (ventes, réceptions…).
                Les écarts seront appliqués sur le stock actuel : voir la colonne « Stock après ».
              </p>
            </div>
          )}
          {inv.statut === "SOUMIS" && bloquantes.length > 0 && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <p>
                Validation impossible en l&apos;état : {bloquantes.map(l => l.produit.nom).join(", ")} passeraient sous zéro ou sous
                les quantités réservées. Renvoyez l&apos;inventaire pour recomptage.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit…"
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-200" />
            </div>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={ecartsSeuls} onChange={e => setEcartsSeuls(e.target.checked)} className="rounded" />
              Écarts uniquement
            </label>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Produit</th>
                  <th className="text-center px-2 py-2 font-medium">Système</th>
                  <th className="text-center px-2 py-2 font-medium">Compté</th>
                  <th className="text-center px-2 py-2 font-medium">Écart</th>
                  <th className="text-right px-2 py-2 font-medium">Valeur</th>
                  {inv.statut === "SOUMIS" && <>
                    <th className="text-center px-2 py-2 font-medium">Stock actuel</th>
                    <th className="text-center px-3 py-2 font-medium">Stock après</th>
                  </>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lignes.map(l => {
                  const cout = Number(l.produit.prixAchat ?? l.produit.prixUnitaire);
                  const bouge = l.stockActuel !== l.quantiteSysteme;
                  const bloque = l.ecart !== 0 && (l.stockApresValidation < 0 || l.stockApresValidation < l.quantiteReservee);
                  return (
                    <tr key={l.id} className={bloque ? "bg-red-50" : ""}>
                      <td className="px-3 py-1.5">
                        <p className="font-medium text-slate-800">{l.produit.nom}</p>
                        {l.produit.reference && <p className="text-[10px] text-slate-400">{l.produit.reference}</p>}
                      </td>
                      <td className="text-center px-2 py-1.5 text-slate-600">{l.quantiteSysteme}</td>
                      <td className="text-center px-2 py-1.5 font-semibold text-slate-800">{l.quantiteConstatee}</td>
                      <td className={`text-center px-2 py-1.5 font-semibold ${l.ecart > 0 ? "text-emerald-600" : l.ecart < 0 ? "text-red-600" : "text-slate-400"}`}>
                        {l.ecart > 0 ? `+${l.ecart}` : l.ecart}
                      </td>
                      <td className={`text-right px-2 py-1.5 ${l.ecart < 0 ? "text-red-600" : l.ecart > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                        {l.ecart ? formatCurrency(l.ecart * cout) : "—"}
                      </td>
                      {inv.statut === "SOUMIS" && <>
                        <td className={`text-center px-2 py-1.5 ${bouge ? "text-amber-600 font-semibold" : "text-slate-500"}`}>{l.stockActuel}</td>
                        <td className={`text-center px-3 py-1.5 font-semibold ${bloque ? "text-red-600" : "text-slate-800"}`}>{l.stockApresValidation}</td>
                      </>}
                    </tr>
                  );
                })}
                {lignes.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                    {ecartsSeuls ? "Aucun écart : le comptage correspond au stock système." : "Aucun produit ne correspond."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {inv.statut === "SOUMIS" && (
            mode ? (
              <div className={`p-4 rounded-xl border ${mode === "VALIDER" ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"}`}>
                <p className="text-sm font-semibold text-slate-800 mb-2">
                  {mode === "VALIDER"
                    ? `Valider : ${inv.stats.nbEcarts} écart(s) seront appliqués au stock de ${inv.pointDeVente.nom}.`
                    : "Renvoyer l'inventaire au magasinier pour recomptage"}
                </p>
                <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={2}
                  placeholder={mode === "VALIDER" ? "Commentaire (optionnel)" : "Motif du rejet (obligatoire) — ex : recompter le rayon boissons"}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-200" />
                <div className="flex justify-end gap-2 mt-3">
                  <Button variant="ghost" onClick={() => { setMode(null); setCommentaire(""); }} disabled={busy}>Retour</Button>
                  <Button variant={mode === "VALIDER" ? "success" : "danger"} loading={busy} onClick={() => agir(mode)}
                    icon={mode === "VALIDER" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}>
                    {mode === "VALIDER" ? "Confirmer la validation" : "Confirmer le rejet"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="danger" icon={<XCircle size={16} />} onClick={() => setMode("REJETER")}>Rejeter (recomptage)</Button>
                <Button variant="success" icon={<CheckCircle2 size={16} />} onClick={() => setMode("VALIDER")} disabled={bloquantes.length > 0}>
                  Valider l&apos;inventaire
                </Button>
              </div>
            )
          )}
        </div>
      )}
    </Modal>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "red" | "emerald" }) {
  const cls = tone === "red" ? "text-red-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-800";
  return (
    <div className="rounded-xl border border-slate-200 p-2.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-sm font-bold ${cls}`}>{value}</p>
    </div>
  );
}
