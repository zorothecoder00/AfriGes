"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wallet, Search, ArrowLeft, Loader2, CheckCircle2, User, MapPin, Phone, Hash, Building2, X, Banknote,
} from "lucide-react";
import { toast } from "sonner";
import ClienteleTabBar from "@/components/ClienteleTabBar";

const MODES = ["Espèces", "Mobile Money", "Carte", "Virement"];

interface ClientHit {
  id: number; nom: string; prenom: string; telephone: string;
  codeClient: string | null; quartier: string | null; ville: string | null; commune: string | null;
  agentTerrain: { nom: string; prenom: string } | null;
  pointDeVente: { nom: string; code: string } | null;
}

interface CompteCree {
  id: number; numeroCompte: string; ribComplet: string; cleRib: string;
  codeAgence: string; codeGuichet: string;
}

export default function NouveauCompteCourantPage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<ClientHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ClientHit | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cree, setCree] = useState<CompteCree | null>(null);

  // Dépôt d'ouverture (optionnel) + montant minimum issu du paramétrage
  const [depotOuverture, setDepotOuverture] = useState("");
  const [modeOuverture, setModeOuverture] = useState(MODES[0]);
  const [minOuverture, setMinOuverture] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/comptes-courants/parametrage")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setMinOuverture(Number(j.data.montantMinOuverture)); })
      .catch(() => { /* ignore */ });
  }, []);

  // Recherche client (debounce) tant qu'aucun n'est sélectionné
  useEffect(() => {
    if (selected || searchInput.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/clients?search=${encodeURIComponent(searchInput)}&limit=8`);
        const j = await r.json();
        setResults(j.data ?? []);
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, selected]);

  const ouvrir = async () => {
    if (!selected) return;
    const depot = depotOuverture.trim() ? Number(depotOuverture) : 0;
    if (depotOuverture.trim() && (isNaN(depot) || depot < 0)) { toast.error("Dépôt d'ouverture invalide"); return; }
    if (depot > 0 && minOuverture != null && depot < minOuverture) {
      toast.error(`Dépôt d'ouverture minimum : ${minOuverture.toLocaleString("fr-FR")} FCFA`); return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/comptes-courants", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selected.id,
          ...(depot > 0 ? { depotInitial: depot, modePaiement: modeOuverture } : {}),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setCree(j.data as CompteCree);
      toast.success(depot > 0 ? "Compte ouvert avec dépôt initial ✓" : "Compte courant ouvert ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'ouverture");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Link href="/dashboard/admin/comptes-courants" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour aux comptes courants
        </Link>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-emerald-600" /> Nouveau compte courant
        </h2>

        {/* ── Étape succès ── */}
        {cree ? (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Compte ouvert pour {selected?.prenom} {selected?.nom}</h3>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 inline-block text-left">
              <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <span className="text-gray-500">Numéro de compte</span>
                <span className="font-mono font-bold text-emerald-700 text-base">{cree.numeroCompte}</span>
                <span className="text-gray-500">RIB complet</span>
                <span className="font-mono font-semibold text-gray-800">{cree.ribComplet}</span>
                <span className="text-gray-500">Agence / Guichet</span>
                <span className="text-gray-700">{cree.codeAgence} · {cree.codeGuichet} · clé {cree.cleRib}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link href={`/dashboard/admin/comptes-courants/${cree.id}`}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium">
                Voir le compte
              </Link>
              <button onClick={() => { setCree(null); setSelected(null); setSearchInput(""); }}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
                Ouvrir un autre compte
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">1. Sélectionner le client</p>
              {!selected ? (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      autoFocus value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Rechercher par nom, téléphone ou code client…"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                    />
                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
                  </div>
                  {results.length > 0 && (
                    <div className="mt-2 border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden">
                      {results.map((c) => (
                        <button key={c.id} onClick={() => { setSelected(c); setResults([]); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-emerald-50/50 flex items-center justify-between">
                          <span>
                            <span className="font-medium text-gray-800">{c.prenom} {c.nom}</span>
                            <span className="text-xs text-gray-400 ml-2">{c.telephone}{c.codeClient ? ` · ${c.codeClient}` : ""}</span>
                          </span>
                          <span className="text-xs text-gray-400">{c.commune || c.ville || ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchInput.trim().length >= 2 && !searching && results.length === 0 && (
                    <p className="text-xs text-gray-400 mt-2">Aucun client trouvé.</p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 relative">
                  <button onClick={() => setSelected(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" title="Changer de client">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
                    <Info icon={<User className="w-4 h-4" />} label="Nom & prénom" value={`${selected.prenom} ${selected.nom}`} />
                    <Info icon={<Hash className="w-4 h-4" />} label="Code client" value={selected.codeClient ?? "—"} />
                    <Info icon={<Phone className="w-4 h-4" />} label="Téléphone" value={selected.telephone} />
                    <Info icon={<Building2 className="w-4 h-4" />} label="Communauté" value={selected.commune ?? "—"} />
                    <Info icon={<MapPin className="w-4 h-4" />} label="Zone" value={selected.ville ?? "—"} />
                    <Info icon={<MapPin className="w-4 h-4" />} label="Quartier" value={selected.quartier ?? "—"} />
                    <Info icon={<User className="w-4 h-4" />} label="Agent" value={selected.agentTerrain ? `${selected.agentTerrain.prenom} ${selected.agentTerrain.nom}` : "—"} />
                    <Info icon={<Building2 className="w-4 h-4" />} label="Point de vente" value={selected.pointDeVente ? `${selected.pointDeVente.nom} (${selected.pointDeVente.code})` : "—"} />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Dépôt d'ouverture (optionnel) */}
            {selected && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" /> 2. Dépôt d&apos;ouverture <span className="font-normal text-gray-400">(optionnel)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-500">Montant (FCFA)</span>
                    <input
                      type="number" min={0} value={depotOuverture} onChange={(e) => setDepotOuverture(e.target.value)}
                      placeholder={minOuverture != null ? `min. ${minOuverture.toLocaleString("fr-FR")}` : "0"}
                      className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-500">Mode de paiement</span>
                    <select value={modeOuverture} onChange={(e) => setModeOuverture(e.target.value)}
                      disabled={!depotOuverture.trim()}
                      className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50">
                      {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  {minOuverture != null && minOuverture > 0
                    ? `Laisser vide pour ouvrir sans dépôt. Si renseigné, minimum ${minOuverture.toLocaleString("fr-FR")} FCFA.`
                    : "Laisser vide pour ouvrir le compte à solde nul."}
                </p>
              </div>
            )}

            <div className="pt-1">
              <p className="text-xs text-gray-400 mb-3">
                Le numéro de compte (12 chiffres) et la clé RIB seront générés automatiquement à l&apos;ouverture.
              </p>
              <button onClick={ouvrir} disabled={!selected || submitting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold shadow-sm">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                Ouvrir le compte courant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-emerald-500 mt-0.5">{icon}</span>
      <div>
        <p className="text-[11px] text-gray-500">{label}</p>
        <p className="font-medium text-gray-800">{value}</p>
      </div>
    </div>
  );
}
