"use client";

// Relevé fournisseur imprimable (CDC Comptabilité §17) — symétrique du relevé
// client (§16), même approche window.print().

import { use } from "react";
import { Printer } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

interface LigneReleve { id: number; date: string; reference: string; journal: string; libelle: string; debit: number; credit: number; solde: number }
interface ReleveResponse {
  data: {
    fournisseur: { nom: string; code: string | null; telephone: string | null; adresse: string | null };
    periode: { debut: string | null; fin: string };
    compte: { numero: string; libelle: string } | null;
    soldeOuverture: number;
    lignes: LigneReleve[];
    soldeFinal: number;
  };
}

export default function ReleveFournisseurPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data } = useApi<ReleveResponse>(`/api/comptable/fournisseurs/${id}/releve`);
  const r = data?.data;

  return (
    <main className="max-w-[900px] mx-auto w-full px-6 py-8">
      <div className="flex justify-end mb-4 print:hidden">
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
          <Printer size={15} /> Imprimer
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-8 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4 mb-6">
          <div>
            <p className="font-bold text-lg text-slate-800">{SOCIETE.nom}</p>
            <p className="text-xs text-slate-500">{SOCIETE_LEGAL}</p>
            <p className="text-xs text-slate-500">{SOCIETE.adresse}</p>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold text-slate-800">Relevé de compte fournisseur</h1>
            <p className="text-xs text-slate-500">
              Période : {r?.periode.debut ? formatDateShort(r.periode.debut) : "origine"} → {r ? formatDateShort(r.periode.fin) : "…"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Fournisseur</p>
            <p className="font-bold text-slate-800">{r?.fournisseur.nom ?? "…"}</p>
            {r?.fournisseur.code && <p className="text-slate-500 text-xs">{r.fournisseur.code}</p>}
            <p className="text-slate-500 text-xs">{r?.fournisseur.telephone}</p>
            {r?.fournisseur.adresse && <p className="text-slate-500 text-xs">{r.fournisseur.adresse}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Compte</p>
            <p className="font-mono font-bold text-slate-800">{r?.compte?.numero ?? "—"}</p>
            <p className="text-xs text-slate-400 mt-2">Solde d&apos;ouverture</p>
            <p className="font-semibold text-slate-700">{formatCurrency(r?.soldeOuverture ?? 0)}</p>
          </div>
        </div>

        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-300">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Référence</th>
              <th className="text-left py-2">Libellé</th>
              <th className="text-right py-2">Débit</th>
              <th className="text-right py-2">Crédit</th>
              <th className="text-right py-2">Solde dû</th>
            </tr>
          </thead>
          <tbody>
            {(r?.lignes ?? []).map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="py-1.5">{formatDateShort(l.date)}</td>
                <td className="py-1.5 font-mono">{l.reference}</td>
                <td className="py-1.5">{l.libelle}</td>
                <td className="py-1.5 text-right">{l.debit > 0 ? formatCurrency(l.debit) : ""}</td>
                <td className="py-1.5 text-right">{l.credit > 0 ? formatCurrency(l.credit) : ""}</td>
                <td className="py-1.5 text-right font-semibold">{formatCurrency(l.solde)}</td>
              </tr>
            ))}
            {(r?.lignes ?? []).length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">Aucun mouvement sur la période.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-bold">
              <td colSpan={5} className="py-2 text-right">Solde final dû</td>
              <td className="py-2 text-right">{formatCurrency(r?.soldeFinal ?? 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  );
}
