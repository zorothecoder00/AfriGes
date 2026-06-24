"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { Banknote, RefreshCw, Loader2, Users, Calendar, Wand2, Search, CheckCircle2, XCircle, MinusCircle, X, ArrowLeft } from "lucide-react";

interface CreditAEncaisser {
  clientId: number; clientNom: string; clientPrenom: string; telephone: string;
  creditId: number; reference: string; soldeRestant: number;
  dureeJours: number; numeroJour: number | null; montantAttendu: number;
  montantTotal: number; montantRembourse: number; montantJournalier: number; tauxPaye: number; dateDebut: string; createdAt: string;
}
interface ResultatBatch {
  enregistres: number; ignores: number; montantTotal: number;
  erreurs: { creditId: number; error: string }[];
}
interface Collecteur { id: number; nom: string; prenom: string }

type Ligne = { jour: string; nbJours: string; recu: string; obs: string };

interface RecapLigne {
  client: string; reference: string; jour: string | null; montant: number; observation: string | null; error: string | null;
}
interface Recap extends ResultatBatch {
  submitted: RecapLigne[];
  date: string;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const moisDe = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const jourDe = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");

// Classes Tailwind complètes (le JIT ne détecte pas l'interpolation dynamique).
const ACCENTS = {
  emerald: { text: "text-emerald-600", btn: "bg-emerald-600 hover:bg-emerald-700", ring: "focus:ring-emerald-400", recu: "border-emerald-300 bg-emerald-50/40" },
  indigo:  { text: "text-indigo-600",  btn: "bg-indigo-600 hover:bg-indigo-700",  ring: "focus:ring-indigo-400",  recu: "border-indigo-300 bg-indigo-50/40" },
  teal:    { text: "text-teal-600",    btn: "bg-teal-600 hover:bg-teal-700",      ring: "focus:ring-teal-400",    recu: "border-teal-300 bg-teal-50/40" },
  blue:    { text: "text-blue-600",    btn: "bg-blue-600 hover:bg-blue-700",      ring: "focus:ring-blue-400",    recu: "border-blue-300 bg-blue-50/40" },
} as const;
type AccentKey = keyof typeof ACCENTS;

interface Props {
  /** Chemin GET (liste) + POST (lot). Ex. /api/rvc/credits/saisie-rapide */
  apiBase: string;
  /** Endpoint liste des agents collecteurs (omis pour l'agent terrain = lui-même). */
  collecteursApi?: string;
  /** Couleur d'accent. */
  accent?: AccentKey;
  /** Texte d'aide sur le mode de confirmation. */
  noteConfirmation?: string;
  /** Lien de retour vers la page des crédits (encaissement individuel). */
  backHref?: string;
}

export default function SaisieRapideRemboursement({ apiBase, collecteursApi, accent = "emerald", noteConfirmation, backHref }: Props) {
  const a = ACCENTS[accent] ?? ACCENTS.emerald;
  const [refresh, setRefresh] = useState(0);
  const [agent, setAgent] = useState("");
  // Le choix de l'agent collecteur filtre la liste sur SES clients affectés.
  const { data, loading } = useApi<{ data: CreditAEncaisser[] }>(
    `${apiBase}?_r=${refresh}${agent ? `&agentId=${agent}` : ""}`,
  );
  const items = data?.data ?? [];

  const { data: collData } = useApi<{ data: Collecteur[] }>(collecteursApi ?? null);
  const collecteurs = collecteursApi ? (collData?.data ?? []) : [];

  const [rows, setRows] = useState<Record<number, Ligne>>({});
  const [seededKey, setSeededKey] = useState<string>("");
  const [dateCollecte, setDateCollecte] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);

  // (Re)initialise les lignes quand la liste change.
  useEffect(() => {
    const key = items.map((i) => i.creditId).join(",");
    if (key !== seededKey) {
      const init: Record<number, Ligne> = {};
      items.forEach((it) => { init[it.creditId] = { jour: it.numeroJour ? String(it.numeroJour) : "", nbJours: "1", recu: "", obs: "" }; });
      setRows(init);
      setSeededKey(key);
    }
  }, [items, seededKey]);

  const setRow = (creditId: number, patch: Partial<Ligne>) =>
    setRows((p) => ({ ...p, [creditId]: { ...p[creditId], ...patch } }));

  // Nombre de jours payés en une fois (borné par les jours restants du crédit).
  const nbJoursDe = (it: CreditAEncaisser, row?: Ligne) => {
    const start = parseInt(row?.jour ?? "") || it.numeroJour || 1;
    const max = Math.max(1, it.dureeJours - start + 1);
    return Math.max(1, Math.min(parseInt(row?.nbJours ?? "1") || 1, max));
  };
  // Montant attendu = échéance du jour de départ + montant journalier × jours suppl.,
  // plafonné au solde restant.
  const attenduRow = (it: CreditAEncaisser, row?: Ligne) => {
    const nb = nbJoursDe(it, row);
    return Math.min(it.montantAttendu + it.montantJournalier * (nb - 1), it.soldeRestant);
  };

  // Pré-remplit Reçu = Attendu (multi-jours) pour toutes les lignes encore vides.
  const remplirAttendu = () =>
    setRows((p) => {
      const next = { ...p };
      items.forEach((it) => {
        const row = next[it.creditId];
        if (!row?.recu) {
          const att = attenduRow(it, row);
          if (att > 0) next[it.creditId] = { ...row, recu: String(Math.round(att)) };
        }
      });
      return next;
    });

  const filtered = items.filter((it) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${it.clientPrenom} ${it.clientNom}`.toLowerCase().includes(q)
      || it.telephone?.toLowerCase().includes(q)
      || it.reference.toLowerCase().includes(q);
  });

  const nbSaisis = items.filter((it) => Number(rows[it.creditId]?.recu) > 0).length;
  const totalSaisi = items.reduce((s, it) => s + (Number(rows[it.creditId]?.recu) || 0), 0);

  async function enregistrer() {
    const lignes = items
      .filter((it) => Number(rows[it.creditId]?.recu) > 0)
      .map((it) => {
        const row = rows[it.creditId];
        const nb = nbJoursDe(it, row);
        const startJ = parseInt(row.jour || "") || it.numeroJour || null;
        // Trace le paiement multi-jours dans l'observation (J début → J fin).
        const note = nb > 1 && startJ ? `Paiement ${nb} jours (J${startJ}–J${startJ + nb - 1})` : "";
        const observation = [row.obs, note].filter(Boolean).join(" · ") || null;
        return {
          creditId: it.creditId,
          numeroJour: row.jour || null,
          montant: Number(row.recu),
          observation,
        };
      });
    if (lignes.length === 0) { toast.error("Aucun montant reçu saisi"); return; }

    setSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lignes, agentCollecteurId: agent || undefined, dateCollecte }),
      });
      const json = await res.json();
      if (res.ok) {
        const r: ResultatBatch = json.data;
        // Construit le détail par ligne (client + statut) pour le récapitulatif.
        const submitted: RecapLigne[] = lignes.map((l) => {
          const it = items.find((i) => i.creditId === l.creditId);
          const err = r.erreurs.find((e) => e.creditId === l.creditId);
          return {
            client:      it ? `${it.clientPrenom} ${it.clientNom}` : `Crédit #${l.creditId}`,
            reference:   it?.reference ?? "",
            jour:        l.numeroJour,
            montant:     l.montant,
            observation: l.observation,
            error:       err?.error ?? null,
          };
        });
        toast.success(`${r.enregistres} encaissement(s) — ${fmt(r.montantTotal)} FCFA`);
        setRecap({ ...r, submitted, date: dateCollecte });
        setSeededKey(""); // force la réinitialisation
        setRefresh((x) => x + 1);
      } else {
        toast.error(json.error ?? "Erreur lors de l'enregistrement");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          {backHref && (
            <a href={backHref} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-1">
              <ArrowLeft className="w-4 h-4" /> Retour aux crédits
            </a>
          )}
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Banknote className={`w-5 h-5 ${a.text}`} /> Saisie rapide des remboursements
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Encaissez plusieurs clients en une seule page (tournée du jour).
            {noteConfirmation ? ` ${noteConfirmation}` : ""}
          </p>
        </div>
        <button onClick={() => setRefresh((x) => x + 1)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {/* Barre d'options */}
      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Date de collecte</label>
          <input type="date" value={dateCollecte} onChange={(e) => setDateCollecte(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        {collecteursApi && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Agent collecteur — filtre ses clients</label>
            <select value={agent} onChange={(e) => setAgent(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 min-w-48">
              <option value="">— Moi-même —</option>
              {collecteurs.map((c) => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
            </select>
          </div>
        )}
        <div className="relative">
          <label className="block text-xs font-medium text-slate-600 mb-1">Rechercher</label>
          <Search className="absolute left-2.5 bottom-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Client, tél, réf…"
            className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <button onClick={remplirAttendu} className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700">
          <Wand2 className="w-4 h-4" /> Reçu = Attendu
        </button>
      </div>

      {/* Tableau */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Jour(s)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Attendu</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Reçu</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Observation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && items.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Aucun crédit à encaisser</td></tr>
              ) : filtered.map((it) => {
                const row = rows[it.creditId] ?? { jour: "", nbJours: "1", recu: "", obs: "" };
                return (
                  <tr key={it.creditId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800">{it.clientPrenom} {it.clientNom}</p>
                      <p className="text-xs text-slate-400">{it.reference} · {moisDe(it.dateDebut)} · créé le {jourDe(it.createdAt)}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span>Total {fmt(it.montantTotal)}</span>
                        <span className="text-slate-300">·</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <span className={`block h-full rounded-full ${it.tauxPaye >= 100 ? "bg-emerald-500" : it.tauxPaye >= 50 ? "bg-blue-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, it.tauxPaye)}%` }} />
                          </span>
                          {it.tauxPaye}% payé
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-rose-600 font-medium">reste {fmt(it.soldeRestant)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <select value={row.jour} onChange={(e) => setRow(it.creditId, { jour: e.target.value })}
                          title="Jour de départ"
                          className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                          <option value="">—</option>
                          {Array.from({ length: it.dureeJours }, (_, i) => i + 1).map((j) => <option key={j} value={j}>J{j}</option>)}
                        </select>
                        <span className="text-xs text-slate-400">×</span>
                        <input type="number" min={1} max={it.dureeJours} value={row.nbJours}
                          onChange={(e) => setRow(it.creditId, { nbJours: e.target.value })}
                          title="Nombre de jours payés en une fois"
                          className="w-12 border border-slate-200 rounded-lg px-1.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-300" />
                        <span className="text-[10px] text-slate-400">j</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{attenduRow(it, row) > 0 ? fmt(attenduRow(it, row)) : "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input type="number" min={0} value={row.recu} onChange={(e) => setRow(it.creditId, { recu: e.target.value })}
                        placeholder="0"
                        className={`w-28 border rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 ${a.ring} ${Number(row.recu) > 0 ? a.recu : "border-slate-200"}`} />
                    </td>
                    <td className="px-4 py-2.5">
                      <input value={row.obs} onChange={(e) => setRow(it.creditId, { obs: e.target.value })}
                        placeholder="OK / Partiel / Absent…"
                        className="w-full min-w-40 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barre d'enregistrement */}
      <div className="sticky bottom-4 flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{nbSaisis}</span> encaissement(s) · total <span className="font-semibold text-slate-900">{fmt(totalSaisi)} FCFA</span>
        </p>
        <button onClick={enregistrer} disabled={saving || nbSaisis === 0}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${a.btn}`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
          Enregistrer la tournée
        </button>
      </div>

      {/* Récapitulatif détaillé */}
      {recap && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className={`w-5 h-5 ${a.text}`} /> Récapitulatif de la tournée
              </h2>
              <button onClick={() => setRecap(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Compteurs */}
            <div className="grid grid-cols-3 gap-3 px-6 py-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{recap.enregistres}</p>
                <p className="text-xs text-emerald-600">Enregistrés</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-600">{recap.ignores}</p>
                <p className="text-xs text-slate-500">Ignorés (absents)</p>
              </div>
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-rose-700">{recap.erreurs.length}</p>
                <p className="text-xs text-rose-600">Erreurs</p>
              </div>
            </div>
            <div className="px-6 pb-2 flex items-center justify-between text-sm">
              <span className="text-slate-500">Date : {new Date(recap.date).toLocaleDateString("fr-FR")}</span>
              <span className="font-semibold text-slate-900">Total encaissé : {fmt(recap.montantTotal)} FCFA</span>
            </div>

            {/* Détail par ligne */}
            <div className="px-6 pb-4 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase">
                    <th className="py-2">Client</th>
                    <th className="py-2">Jour</th>
                    <th className="py-2 text-right">Montant</th>
                    <th className="py-2">Observation</th>
                    <th className="py-2 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recap.submitted.map((l, i) => (
                    <tr key={i}>
                      <td className="py-2">
                        <p className="font-medium text-slate-800">{l.client}</p>
                        <p className="text-xs text-slate-400">{l.reference}</p>
                      </td>
                      <td className="py-2 text-slate-500">{l.jour ? `J${l.jour}` : "—"}</td>
                      <td className="py-2 text-right font-semibold text-slate-800">{fmt(l.montant)}</td>
                      <td className="py-2 text-slate-500 text-xs">{l.observation || "—"}</td>
                      <td className="py-2 text-center">
                        {l.error ? (
                          <span title={l.error} className="inline-flex items-center gap-1 text-rose-600 text-xs">
                            <XCircle className="w-3.5 h-3.5" /> Échec
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {recap.erreurs.length > 0 && (
                <div className="mt-3 bg-rose-50 border border-rose-100 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-rose-700 flex items-center gap-1"><MinusCircle className="w-3.5 h-3.5" /> Lignes non enregistrées</p>
                  {recap.submitted.filter((l) => l.error).map((l, i) => (
                    <p key={i} className="text-xs text-rose-600">{l.client} — {l.error}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <button onClick={() => setRecap(null)}
                className={`px-5 py-2 text-sm font-medium text-white rounded-lg ${a.btn}`}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
