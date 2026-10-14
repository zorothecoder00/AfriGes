"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, RefreshCw, Search, Pencil, Trash2, Loader2, Settings2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import RetourLien from "@/components/RetourLien";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { formatCurrency, formatDate } from "@/lib/format";
import { montantCreditReel } from "@/lib/formuleCredit";

/**
 * Crédits clients de l'agence du RPV — correction des erreurs de saisie :
 * modifier / supprimer un remboursement, modifier / supprimer un crédit.
 * Les actions passent par /api/admin/credits/[id]/** (ouvertes au RPV sur son
 * seul point de vente, recalcul financier complet côté serveur).
 */

interface CreditRow {
  id: number; reference: string; statut: string;
  montantTotal: string; montantInteret?: string; montantRembourse: string; soldeRestant: string;
  dureeJours: number; dateDebut: string; createdAt: string;
  client: { id: number; nom: string; prenom: string; codeClient: string | null; telephone: string };
  _count: { remboursements: number };
}

interface Remb {
  id: number; montant: string; statut: string; dateRemboursement: string; modePaiement: string;
  numeroJour: number | null; notes: string | null;
  enregistrePar: { nom: string; prenom: string } | null;
}

interface CreditDetail extends CreditRow {
  fraisDossier: string; tauxPenalite: string; garantie: string | null; observations: string | null;
  remboursements: Remb[];
}

const STATUTS: Record<string, { label: string; badge: string }> = {
  EN_ATTENTE_VALIDATION: { label: "En attente", badge: "bg-amber-100 text-amber-700" },
  VALIDE:    { label: "Validé",    badge: "bg-sky-100 text-sky-700" },
  ACTIF:     { label: "Actif",     badge: "bg-blue-100 text-blue-700" },
  EN_RETARD: { label: "En retard", badge: "bg-red-100 text-red-700" },
  SOLDE:     { label: "Soldé",     badge: "bg-emerald-100 text-emerald-700" },
  ANNULE:    { label: "Annulé",    badge: "bg-slate-200 text-slate-600" },
  REJETE:    { label: "Rejeté",    badge: "bg-slate-200 text-slate-600" },
};

const REMB_STATUTS: Record<string, string> = {
  CONFIRME: "Confirmé", EN_ATTENTE_CAISSIER: "En attente caissier", REJETE: "Rejeté",
};

async function appel(url: string, method: string, body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? j.message ?? "Erreur");
  return j;
}

export default function RpvCreditsPage() {
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search.trim().length >= 2) params.set("search", search.trim());
  if (statut) params.set("statut", statut);
  const { data, loading, refetch } = useApi<{ data: CreditRow[]; meta: { totalPages: number; total: number } }>(
    `/api/rpv/credits?${params}`,
  );
  const credits = data?.data ?? [];

  const [detail, setDetail] = useState<CreditDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [editRemb, setEditRemb] = useState<Remb | null>(null);
  const [rembForm, setRembForm] = useState({ montant: "", date: "", notes: "" });

  const [editCredit, setEditCredit] = useState(false);
  const [creditForm, setCreditForm] = useState({ dureeJours: "", dateDebut: "", fraisDossier: "", garantie: "", observations: "" });

  const ouvrir = async (id: number): Promise<CreditDetail | null> => {
    setDetailLoading(id);
    try {
      const j = await appel(`/api/admin/credits/${id}`, "GET");
      setDetail(j.data);
      return j.data as CreditDetail;
    } catch (e) { toast.error((e as Error).message); return null; }
    finally { setDetailLoading(null); }
  };

  const rafraichir = async () => {
    refetch();
    if (detail) await ouvrir(detail.id);
  };

  // ── Remboursements ────────────────────────────────────────────────────────
  const ouvrirEditRemb = (r: Remb) => {
    setEditRemb(r);
    setRembForm({ montant: String(Number(r.montant)), date: r.dateRemboursement.slice(0, 10), notes: r.notes ?? "" });
  };

  const enregistrerRemb = async () => {
    if (!detail || !editRemb) return;
    const montant = Number(rembForm.montant);
    if (!montant || montant <= 0) { toast.error("Montant invalide — pour annuler un versement, supprimez-le"); return; }
    setBusy(true);
    try {
      await appel(`/api/admin/credits/${detail.id}/remboursements/${editRemb.id}`, "PATCH", {
        montant: montant !== Number(editRemb.montant) ? montant : undefined,
        dateCollecte: rembForm.date || undefined,
        observation: rembForm.notes,
      });
      toast.success("Remboursement corrigé");
      setEditRemb(null);
      await rafraichir();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const supprimerRemb = async (r: Remb) => {
    if (!detail) return;
    if (!confirm(`Supprimer le remboursement de ${formatCurrency(Number(r.montant))} du ${formatDate(r.dateRemboursement)} ?\nLe crédit et le solde du client seront recalculés.`)) return;
    setBusy(true);
    try {
      await appel(`/api/admin/credits/${detail.id}/remboursements/${r.id}`, "DELETE");
      toast.success("Remboursement supprimé — crédit recalculé");
      await rafraichir();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  // ── Crédit ────────────────────────────────────────────────────────────────
  const ouvrirEditCredit = (d: CreditDetail | null = detail) => {
    if (!d) return;
    setCreditForm({
      dureeJours: String(d.dureeJours),
      dateDebut: d.dateDebut.slice(0, 10),
      fraisDossier: String(Number(d.fraisDossier)),
      garantie: d.garantie ?? "",
      observations: d.observations ?? "",
    });
    setEditCredit(true);
  };

  // Bouton « Modifier » de la liste : charge le détail puis ouvre le formulaire.
  const modifierDepuisListe = async (id: number) => {
    const d = await ouvrir(id);
    if (d) ouvrirEditCredit(d);
  };

  const enregistrerCredit = async () => {
    if (!detail) return;
    // N'envoie que les champs réellement modifiés (évite de régénérer l'échéancier pour rien).
    const body: Record<string, unknown> = {};
    if (Number(creditForm.dureeJours) !== detail.dureeJours) body.dureeJours = Number(creditForm.dureeJours);
    if (creditForm.dateDebut !== detail.dateDebut.slice(0, 10)) body.dateDebut = creditForm.dateDebut;
    if (Number(creditForm.fraisDossier) !== Number(detail.fraisDossier)) body.fraisDossier = Number(creditForm.fraisDossier);
    if (creditForm.garantie !== (detail.garantie ?? "")) body.garantie = creditForm.garantie;
    if (creditForm.observations !== (detail.observations ?? "")) body.observations = creditForm.observations;
    if (Object.keys(body).length === 0) { setEditCredit(false); return; }
    setBusy(true);
    try {
      await appel(`/api/admin/credits/${detail.id}`, "PATCH", body);
      toast.success("Crédit modifié");
      setEditCredit(false);
      await rafraichir();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  // Tout statut (y compris soldé) : les remboursements partent avec le crédit.
  const supprimerCredit = async (c: CreditRow | null = detail) => {
    if (!c) return;
    // Le détail (GET) n'a pas _count : on compte alors ses remboursements chargés.
    const nbRemb = "remboursements" in c ? (c as CreditDetail).remboursements.length : c._count.remboursements;
    if (!confirm(`Supprimer définitivement le crédit ${c.reference} de ${c.client.prenom} ${c.client.nom} (${formatCurrency(Number(c.montantTotal))}) ?`
      + (nbRemb > 0 ? `\n\nSes ${nbRemb} remboursement(s) seront aussi supprimés.` : "")
      + `\nLe stock réservé et le solde du client seront rétablis. Action irréversible.`)) return;
    setBusy(true);
    try {
      await appel(`/api/admin/credits/${c.id}`, "DELETE");
      toast.success("Crédit supprimé");
      if (detail?.id === c.id) setDetail(null);
      refetch();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const champ = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200";

  return (
    <div className="min-h-screen bg-[#dbe7f5]">
      <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
        <div>
          <RetourLien defaultHref="/dashboard/user/responsablesPointDeVente" />
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mt-1">
            <CreditCard className="w-6 h-6 text-blue-600" /> Crédits clients de l&apos;agence
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Corriger une erreur de saisie : modifier ou supprimer un remboursement, modifier ou supprimer un crédit.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Client, téléphone ou référence…" className={`${champ} pl-9 bg-white`} />
          </div>
          <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }} className={`${champ} sm:w-48 bg-white`}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={refetch} title="Actualiser" className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 self-start">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading && credits.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
        ) : credits.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <CreditCard className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucun crédit trouvé</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {credits.map((c) => {
              const cfg = STATUTS[c.statut] ?? STATUTS.ACTIF;
              return (
                <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 md:px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{c.client.prenom} {c.client.nom}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {c.reference} · {c.client.telephone} · {c._count.remboursements} remboursement(s)
                    </p>
                  </div>
                  <div className="text-xs text-slate-600 sm:text-right">
                    <p>Crédit <span className="font-semibold">{formatCurrency(montantCreditReel(c))}</span></p>
                    <p>Payé <span className="font-semibold text-emerald-700">{formatCurrency(Number(c.montantRembourse))}</span> · Reste <span className="font-semibold text-red-600">{formatCurrency(Number(c.soldeRestant))}</span></p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => ouvrir(c.id)} disabled={detailLoading === c.id}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-60">
                      {detailLoading === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings2 className="w-3.5 h-3.5" />} Détail
                    </button>
                    <button onClick={() => modifierDepuisListe(c.id)} disabled={detailLoading === c.id || busy}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100 disabled:opacity-60">
                      <Pencil className="w-3.5 h-3.5" /> Modifier
                    </button>
                    <button onClick={() => supprimerCredit(c)} disabled={busy}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-60">
                      <Trash2 className="w-3.5 h-3.5" /> Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data?.meta && data.meta.totalPages > 1 && (
          <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} />
        )}
      </div>

      {/* ── Détail crédit ─────────────────────────────────────────────────── */}
      <Modal open={!!detail && !editRemb && !editCredit} onClose={() => setDetail(null)} title={detail ? `${detail.reference} — ${detail.client.prenom} ${detail.client.nom}` : ""} size="lg">
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-slate-500">Statut</p><p className="font-semibold">{(STATUTS[detail.statut] ?? STATUTS.ACTIF).label}</p></div>
              <div><p className="text-xs text-slate-500">Crédit</p><p className="font-semibold">{formatCurrency(montantCreditReel(detail))}</p>{Number(detail.montantInteret ?? 0) > 0 && <p className="text-[11px] text-emerald-700">+ {formatCurrency(Number(detail.montantInteret))} de 16ème/31ème</p>}</div>
              <div><p className="text-xs text-slate-500">Remboursé</p><p className="font-semibold text-emerald-700">{formatCurrency(Number(detail.montantRembourse))}</p></div>
              <div><p className="text-xs text-slate-500">Reste</p><p className="font-semibold text-red-600">{formatCurrency(Number(detail.soldeRestant))}</p></div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Remboursements ({detail.remboursements.length})
              </p>
              {detail.remboursements.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Aucun remboursement enregistré.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.remboursements.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-slate-50 rounded-lg px-3 py-2 text-xs">
                      <span className="text-slate-600 w-20">{formatDate(r.dateRemboursement)}</span>
                      <span className="flex-1 min-w-[8rem] text-slate-500 truncate">
                        {REMB_STATUTS[r.statut] ?? r.statut}
                        {r.enregistrePar && ` · par ${r.enregistrePar.prenom} ${r.enregistrePar.nom}`}
                      </span>
                      <span className="font-bold text-emerald-700">{formatCurrency(Number(r.montant))}</span>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <button type="button" onClick={() => ouvrirEditRemb(r)} disabled={busy}
                          className="inline-flex items-center gap-1 px-2 py-1 font-medium text-amber-700 bg-white border border-amber-200 rounded-md hover:bg-amber-50 disabled:opacity-60" title="Modifier ce remboursement">
                          <Pencil className="w-3.5 h-3.5" /> Modifier
                        </button>
                        <button type="button" onClick={() => supprimerRemb(r)} disabled={busy}
                          className="inline-flex items-center gap-1 px-2 py-1 font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-60" title="Supprimer ce remboursement">
                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => ouvrirEditCredit()} disabled={busy}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100">
                <Pencil className="w-4 h-4" /> Modifier le crédit
              </button>
              <button onClick={() => supprimerCredit()} disabled={busy}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100">
                <Trash2 className="w-4 h-4" /> Supprimer le crédit
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modifier un remboursement ─────────────────────────────────────── */}
      <Modal open={!!editRemb} onClose={() => setEditRemb(null)} title="Modifier le remboursement" size="sm">
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-slate-600">Montant (FCFA)</span>
            <input type="number" min={1} value={rembForm.montant} onChange={(e) => setRembForm({ ...rembForm, montant: e.target.value })} className={champ} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Date de collecte</span>
            <input type="date" value={rembForm.date} onChange={(e) => setRembForm({ ...rembForm, date: e.target.value })} className={champ} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Observation</span>
            <input value={rembForm.notes} onChange={(e) => setRembForm({ ...rembForm, notes: e.target.value })} className={champ} />
          </label>
          <p className="text-xs text-slate-500">Si le client n&apos;a rien payé, utilisez plutôt la suppression du remboursement.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setEditRemb(null)} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button onClick={enregistrerRemb} disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modifier le crédit ────────────────────────────────────────────── */}
      <Modal open={editCredit} onClose={() => setEditCredit(false)} title="Modifier le crédit" size="md">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-600">Durée (jours)</span>
              <input type="number" min={1} value={creditForm.dureeJours} onChange={(e) => setCreditForm({ ...creditForm, dureeJours: e.target.value })} className={champ} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Date de début</span>
              <input type="date" value={creditForm.dateDebut} onChange={(e) => setCreditForm({ ...creditForm, dateDebut: e.target.value })} className={champ} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Frais de dossier (FCFA)</span>
              <input type="number" min={0} value={creditForm.fraisDossier} onChange={(e) => setCreditForm({ ...creditForm, fraisDossier: e.target.value })} className={champ} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Garantie</span>
              <input value={creditForm.garantie} onChange={(e) => setCreditForm({ ...creditForm, garantie: e.target.value })} className={champ} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-600">Observations</span>
            <textarea rows={2} value={creditForm.observations} onChange={(e) => setCreditForm({ ...creditForm, observations: e.target.value })} className={champ} />
          </label>
          <p className="text-xs text-slate-500">
            Modifiable quel que soit le statut, même soldé : l&apos;échéancier est régénéré, le déjà-payé réimputé et le
            statut recalculé. Pour corriger un montant encaissé, modifiez le remboursement lui-même.
            Crédit rejeté ou annulé : seules garantie et observations sont modifiables.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setEditCredit(false)} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button onClick={enregistrerCredit} disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
