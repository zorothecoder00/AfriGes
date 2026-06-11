"use client";

import { useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Plus, Search, RefreshCw, User, Phone, Mail, ChevronRight,
  Wallet, TrendingUp, CheckCircle, XCircle, Copy, KeyRound,
} from "lucide-react";
import Link from "next/link";

interface Portefeuille {
  id: number; reference: string; nom: string | null; actif: boolean;
  capitalInvesti: number; capitalDisponible: number; capitalEngage: number;
  capitalRecouvre: number; capitalBloque: number;
  beneficesGeneres: number; beneficesDistribues: number; beneficesReinvestis: number;
  fondSecurite: number;
}
interface Investisseur {
  id: number;
  member: { id: number; nom: string; prenom: string; email: string; telephone: string | null; photo: string | null; etat: string; dateAdhesion: string };
  profilRIA: { id: number; profession: string | null; pays: string | null; portefeuilles: Portefeuille[] } | null;
}

const fmt   = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(Math.round(n));
const toNum = (v: unknown) => Number(v ?? 0);

function CreateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    nom: "", prenom: "", email: "", telephone: "", adresse: "",
    profession: "", pays: "", notes: "",
    avecPortefeuille: true, nomPortefeuille: "Portefeuille Principal",
  });
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));
  const mutation = useMutation<{ tmpPassword: string }, typeof form>("/api/admin/ria/investisseurs", "POST");

  const submit = async () => {
    if (!form.nom || !form.prenom || !form.email) { toast.error("Nom, prénom et email sont obligatoires"); return; }
    const res = await mutation.mutate(form);
    if (res) { toast.success("Investisseur créé"); onSuccess(); setCredentials({ email: form.email, password: res.tmpPassword }); }
    else toast.error(mutation.error ?? "Erreur lors de la création");
  };
  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copié !"); };

  if (credentials) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl"><KeyRound className="w-5 h-5 text-emerald-600" /></div>
            <div><h2 className="text-lg font-bold text-slate-900">Investisseur créé !</h2><p className="text-sm text-slate-500">Transmettez ces identifiants</p></div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Identifiants de connexion</p>
            {[["Email", credentials.email], ["Mot de passe temporaire", credentials.password]].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between gap-2">
                <div><p className="text-xs text-slate-400">{l}</p><p className="font-mono font-bold text-slate-900">{v}</p></div>
                <button onClick={() => copy(v)} className="p-1.5 text-slate-400 hover:text-slate-600"><Copy className="w-4 h-4" /></button>
              </div>
            ))}
            <p className="text-xs text-amber-600">L&apos;investisseur devra changer son mot de passe à la première connexion.</p>
          </div>
          <button onClick={onClose} className="w-full px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">Fermer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Nouvel investisseur RIA</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[["nom", "Nom *"], ["prenom", "Prénom *"]].map(([k, l]) => (
              <div key={k}><label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
                <input value={form[k as keyof typeof form] as string} onChange={(e) => set(k, e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" /></div>
            ))}
          </div>
          {[["email","Email *","email"],["telephone","Téléphone","tel"],["adresse","Adresse","text"]].map(([k,l,t]) => (
            <div key={k}><label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
              <input type={t} value={form[k as keyof typeof form] as string} onChange={(e) => set(k, e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" /></div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            {[["profession","Profession"],["pays","Pays"]].map(([k,l]) => (
              <div key={k}><label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
                <input value={form[k as keyof typeof form] as string} onChange={(e) => set(k, e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" /></div>
            ))}
          </div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" /></div>
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input type="checkbox" checked={form.avecPortefeuille} onChange={(e) => set("avecPortefeuille", e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              Créer un portefeuille initial
            </label>
            {form.avecPortefeuille && (
              <div className="mt-2"><label className="block text-xs font-medium text-slate-600 mb-1">Nom du portefeuille</label>
                <input value={form.nomPortefeuille} onChange={(e) => set("nomPortefeuille", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" /></div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={mutation.loading}
            className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {mutation.loading ? "Création…" : "Créer l'investisseur"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RIAInvestisseursPage() {
  const [search, setSearch]       = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { data: res, loading, refetch } = useApi<{ data: Investisseur[]; meta: { total: number } }>(
    `/api/admin/ria/investisseurs?limit=30&search=${encodeURIComponent(search)}`
  );
  const investisseurs = res?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Investisseurs RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">{res?.meta.total ?? 0} investisseur(s) enregistré(s)</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={refetch} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nouvel investisseur
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, prénom, email, téléphone…"
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
      </div>

      {loading && !investisseurs.length ? (
        <div className="flex items-center justify-center h-32 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {investisseurs.map((inv) => {
            const m = inv.member;
            const profil = inv.profilRIA;
            const totalInvesti    = profil?.portefeuilles.reduce((s, p) => s + toNum(p.capitalInvesti),    0) ?? 0;
            const totalDisponible = profil?.portefeuilles.reduce((s, p) => s + toNum(p.capitalDisponible), 0) ?? 0;
            const totalBenef      = profil?.portefeuilles.reduce((s, p) => s + toNum(p.beneficesGeneres),  0) ?? 0;
            return (
              <Link key={inv.id} href={`/dashboard/user/responsablesRIA/investisseurs/${m.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
                      {m.prenom[0]}{m.nom[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{m.prenom} {m.nom}</p>
                      {profil?.profession && <p className="text-xs text-slate-500 truncate">{profil.profession}</p>}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${m.etat === "ACTIF" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {m.etat === "ACTIF" ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}{m.etat}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500"><Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate">{m.email}</span></div>
                  {m.telephone && <div className="flex items-center gap-2 text-xs text-slate-500"><Phone className="w-3 h-3 flex-shrink-0" /><span>{m.telephone}</span></div>}
                </div>
                <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2">
                  <div><p className="text-xs text-slate-400 flex items-center gap-1"><Wallet className="w-3 h-3" /> Investi</p><p className="text-sm font-semibold text-slate-800">{fmt(totalInvesti)} <span className="text-xs font-normal text-slate-400">F</span></p></div>
                  <div><p className="text-xs text-slate-400 flex items-center gap-1"><User className="w-3 h-3" /> Dispo</p><p className="text-sm font-semibold text-emerald-700">{fmt(totalDisponible)} <span className="text-xs font-normal text-slate-400">F</span></p></div>
                  <div><p className="text-xs text-slate-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Bénéf.</p><p className="text-sm font-semibold text-blue-600">{fmt(totalBenef)} <span className="text-xs font-normal text-slate-400">F</span></p></div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{profil?.portefeuilles.length ?? 0} portefeuille(s)</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Link>
            );
          })}
          {!loading && investisseurs.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
              <User className="w-8 h-8" /><p>Aucun investisseur trouvé</p>
            </div>
          )}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onSuccess={refetch} />}
    </div>
  );
}
