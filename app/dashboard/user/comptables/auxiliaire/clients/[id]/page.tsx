"use client";

// Fiche client comptable (CDC Comptabilité §16 — "module auxiliaire clients") :
// identité, plafond de crédit, solde, créances échues/non échues, grand livre
// auxiliaire (compte 411xxx, solde progressif), avoirs, litiges. Complète
// /dashboard/user/comptables/auxiliaire (recherche + balance âgée + lettrage).

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, User, Phone, MapPin, CreditCard, Wallet, Calendar,
  AlertTriangle, FileText, Printer, PlusCircle, Scale,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";

interface ClientInfo {
  id: number; nom: string; prenom: string; codeClient: string | null; telephone: string; adresse: string | null;
  limiteCredit: number | null; soldeActuel: number | null; delaiPaiementJours: number;
}
interface LigneGrandLivre {
  id: number; date: string; reference: string; journal: string; libelle: string;
  debit: number; credit: number; lettrage: string | null; solde: number;
}
interface GrandLivreResponse { data: { compte: { numero: string; libelle: string } | null; soldeOuverture: number; lignes: LigneGrandLivre[]; soldeFinal: number } }
interface LigneCreance { type: string; reference: string; dateEcheance: string; montantDu: number; montantRestant: number; echue: boolean; joursRetard: number }
interface CreancesResponse { data: { echues: LigneCreance[]; nonEchues: LigneCreance[]; totalEchues: number; totalNonEchues: number } }
interface AvoirEntry { id: number; reference: string; montant: number; motif: string; statut: string; dateEmission: string; creePar: { nom: string; prenom: string } }
interface LitigeEntry { id: number; reference: string; motif: string; montantConteste: number | null; statut: string; dateOuverture: string; dateResolution: string | null; notes: string | null }

const STATUT_LITIGE_LABELS: Record<string, string> = { OUVERT: "Ouvert", EN_COURS: "En cours", RESOLU: "Résolu", CLOTURE: "Clôturé" };
const STATUT_LITIGE_COLORS: Record<string, string> = {
  OUVERT: "bg-red-50 text-red-700", EN_COURS: "bg-amber-50 text-amber-700",
  RESOLU: "bg-emerald-50 text-emerald-700", CLOTURE: "bg-slate-100 text-slate-500",
};

export default function FicheClientComptablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const clientId = Number(id);

  const { data: clientData } = useApi<{ data: ClientInfo }>(`/api/comptable/clients/${clientId}`);
  const client = clientData?.data;

  const { data: grandLivreData, loading: grandLivreLoading } = useApi<GrandLivreResponse>(`/api/comptable/clients/${clientId}/grand-livre`);
  const { data: creancesData } = useApi<CreancesResponse>(`/api/comptable/clients/${clientId}/creances`);
  const { data: avoirsData, refetch: refetchAvoirs } = useApi<{ data: AvoirEntry[] }>(`/api/comptable/clients/${clientId}/avoirs`);
  const { data: litigesData, refetch: refetchLitiges } = useApi<{ data: LitigeEntry[] }>(`/api/comptable/clients/${clientId}/litiges`);

  const [showAvoirForm, setShowAvoirForm] = useState(false);
  const [avoirMontant, setAvoirMontant] = useState("");
  const [avoirMotif, setAvoirMotif] = useState("");
  const { mutate: creerAvoir, loading: creatingAvoir } = useMutation<unknown, object>(
    `/api/comptable/clients/${clientId}/avoirs`, "POST", { successMessage: "Avoir émis" }
  );
  async function handleCreerAvoir() {
    const res = await creerAvoir({ montant: Number(avoirMontant), motif: avoirMotif });
    if (res) { refetchAvoirs(); setShowAvoirForm(false); setAvoirMontant(""); setAvoirMotif(""); }
  }

  const [showLitigeForm, setShowLitigeForm] = useState(false);
  const [litigeMotif, setLitigeMotif] = useState("");
  const [litigeMontant, setLitigeMontant] = useState("");
  const { mutate: creerLitige, loading: creatingLitige } = useMutation<unknown, object>(
    `/api/comptable/clients/${clientId}/litiges`, "POST", { successMessage: "Litige ouvert" }
  );
  async function handleCreerLitige() {
    const res = await creerLitige({ motif: litigeMotif, montantConteste: litigeMontant ? Number(litigeMontant) : undefined });
    if (res) { refetchLitiges(); setShowLitigeForm(false); setLitigeMotif(""); setLitigeMontant(""); }
  }

  async function handleChangerStatutLitige(litigeId: number, statut: string) {
    await fetch(`/api/comptable/clients/${clientId}/litiges/${litigeId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut }),
    });
    refetchLitiges();
  }

  const gl = grandLivreData?.data;
  const creances = creancesData?.data;

  return (
    <main className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/user/comptables/auxiliaire" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <User className="text-violet-600" size={22} />
            {client ? `${client.prenom} ${client.nom}` : "Fiche client comptable"}
          </h1>
        </div>
        <a href={`/dashboard/user/comptables/auxiliaire/clients/${clientId}/releve`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
          <Printer size={15} /> Relevé imprimable
        </a>
      </div>

      {/* Identité & conditions */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-1"><FileText size={13} />Code client</p>
          <p className="font-bold text-slate-800">{client?.codeClient ?? "—"}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-1"><Phone size={13} />Téléphone</p>
          <p className="font-bold text-slate-800">{client?.telephone ?? "—"}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-1"><MapPin size={13} />Adresse</p>
          <p className="font-bold text-slate-800 truncate">{client?.adresse ?? "—"}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-1"><CreditCard size={13} />Plafond de crédit</p>
          <p className="font-bold text-slate-800">{client?.limiteCredit != null ? formatCurrency(client.limiteCredit) : "—"}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-1"><Calendar size={13} />Conditions de paiement</p>
          <p className="font-bold text-slate-800">{client ? (client.delaiPaiementJours > 0 ? `${client.delaiPaiementJours} jours` : "Comptant") : "—"}</p>
        </div>
      </div>

      {/* Solde & créances échues/non échues */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-1"><Wallet size={13} />Solde compte auxiliaire ({gl?.compte?.numero ?? "—"})</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(gl?.soldeFinal ?? 0)}</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-5 shadow-sm border border-red-200">
          <p className="text-xs text-red-600 flex items-center gap-1.5 mb-1"><AlertTriangle size={13} />Créances échues</p>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(creances?.totalEchues ?? 0)}</p>
          <p className="text-xs text-red-500 mt-0.5">{creances?.echues.length ?? 0} échéance(s)/facture(s)</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-5 shadow-sm border border-blue-200">
          <p className="text-xs text-blue-600 flex items-center gap-1.5 mb-1"><Calendar size={13} />Créances non échues</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(creances?.totalNonEchues ?? 0)}</p>
          <p className="text-xs text-blue-500 mt-0.5">{creances?.nonEchues.length ?? 0} échéance(s)/facture(s)</p>
        </div>
      </div>

      {creances && creances.echues.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-100">
            <h3 className="font-bold text-red-800 text-sm">Détail des créances échues</h3>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-50">
              {creances.echues.map((c, i) => (
                <tr key={i}>
                  <td className="px-5 py-2 text-slate-600">{c.reference}</td>
                  <td className="px-5 py-2 text-slate-400 text-xs">échue le {formatDateShort(c.dateEcheance)}</td>
                  <td className="px-5 py-2 text-red-600 font-medium text-xs">{c.joursRetard} j de retard</td>
                  <td className="px-5 py-2 text-right font-bold text-red-700">{formatCurrency(c.montantRestant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grand livre auxiliaire */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Scale size={16} className="text-violet-600" />
          <h3 className="font-bold text-slate-800 text-sm">Grand livre auxiliaire</h3>
        </div>
        {grandLivreLoading ? (
          <div className="flex items-center justify-center p-8"><div className="w-7 h-7 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="text-left px-5 py-2 font-semibold text-slate-500">Date</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Référence</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Libellé</th>
                  <th className="text-right px-3 py-2 font-semibold text-blue-600">Débit</th>
                  <th className="text-right px-3 py-2 font-semibold text-emerald-600">Crédit</th>
                  <th className="text-right px-5 py-2 font-semibold text-slate-500">Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(gl?.lignes ?? []).map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-5 py-1.5 text-slate-500">{formatDateShort(l.date)}</td>
                    <td className="px-3 py-1.5 font-mono text-slate-500">{l.reference}</td>
                    <td className="px-3 py-1.5 text-slate-700">{l.libelle}</td>
                    <td className="px-3 py-1.5 text-right text-blue-700">{l.debit > 0 ? formatCurrency(l.debit) : ""}</td>
                    <td className="px-3 py-1.5 text-right text-emerald-700">{l.credit > 0 ? formatCurrency(l.credit) : ""}</td>
                    <td className="px-5 py-1.5 text-right font-bold text-slate-800">{formatCurrency(l.solde)}</td>
                  </tr>
                ))}
                {(gl?.lignes ?? []).length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">Aucun mouvement.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Avoirs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Avoirs</h3>
          <button onClick={() => setShowAvoirForm(!showAvoirForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700">
            <PlusCircle size={13} /> Émettre un avoir
          </button>
        </div>
        {showAvoirForm && (
          <div className="p-4 bg-violet-50/50 border-b border-violet-100 flex gap-3 flex-wrap items-end">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Montant</label>
              <input type="number" value={avoirMontant} onChange={(e) => setAvoirMontant(e.target.value)}
                className="w-40 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Motif</label>
              <input value={avoirMotif} onChange={(e) => setAvoirMotif(e.target.value)}
                placeholder="ex: Retour marchandise"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <button onClick={handleCreerAvoir} disabled={creatingAvoir || !avoirMontant || !avoirMotif}
              className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
              Émettre
            </button>
          </div>
        )}
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-50">
            {(avoirsData?.data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="px-5 py-2 font-mono text-xs text-violet-700">{a.reference}</td>
                <td className="px-3 py-2 text-slate-600">{a.motif}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{formatDateShort(a.dateEmission)}</td>
                <td className="px-5 py-2 text-right font-bold text-slate-800">{formatCurrency(a.montant)}</td>
              </tr>
            ))}
            {(avoirsData?.data ?? []).length === 0 && (
              <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-400 text-sm">Aucun avoir émis.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Litiges */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Litiges</h3>
          <button onClick={() => setShowLitigeForm(!showLitigeForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600">
            <PlusCircle size={13} /> Ouvrir un litige
          </button>
        </div>
        {showLitigeForm && (
          <div className="p-4 bg-red-50/50 border-b border-red-100 flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Motif</label>
              <input value={litigeMotif} onChange={(e) => setLitigeMotif(e.target.value)}
                placeholder="ex: Contestation de facture"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Montant contesté</label>
              <input type="number" value={litigeMontant} onChange={(e) => setLitigeMontant(e.target.value)}
                className="w-40 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            </div>
            <button onClick={handleCreerLitige} disabled={creatingLitige || !litigeMotif}
              className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50">
              Ouvrir
            </button>
          </div>
        )}
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-50">
            {(litigesData?.data ?? []).map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-2 font-mono text-xs text-slate-500">{l.reference}</td>
                <td className="px-3 py-2 text-slate-600">{l.motif}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{formatDateShort(l.dateOuverture)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{l.montantConteste != null ? formatCurrency(l.montantConteste) : "—"}</td>
                <td className="px-3 py-2 text-center">
                  <select value={l.statut} onChange={(e) => handleChangerStatutLitige(l.id, e.target.value)}
                    className={`text-xs font-semibold px-2 py-1 rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-red-400 ${STATUT_LITIGE_COLORS[l.statut]}`}>
                    {Object.entries(STATUT_LITIGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {(litigesData?.data ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400 text-sm">Aucun litige.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
