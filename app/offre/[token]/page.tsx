"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

interface Ligne { produitNom: string; quantite: number; prixUnitaire: number; totalLigne: number }
interface OffreData {
  reference: string; type: string; statut: string;
  clientNom: string; pointDeVenteNom: string; dateValidite: string; conditions: string | null;
  lignes: Ligne[];
  totalHT: number; totalRemise: number; totalTVA: number; totalTTC: number;
  nomSignataireReponse: string | null; motifRefus: string | null;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

export default function OffreCommercialePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<OffreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nomSignataire, setNomSignataire] = useState("");
  const [motifRefus, setMotifRefus] = useState("");
  const [showRefus, setShowRefus] = useState(false);
  const [saving, setSaving] = useState(false);

  const charger = () => {
    fetch(`/api/offres/${token}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Erreur");
        setData(j.data as OffreData); setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  };
  useEffect(charger, [token]);

  const repondre = async (action: "ACCEPTER" | "REFUSER") => {
    if (action === "ACCEPTER" && !nomSignataire.trim()) { toast.error("Indiquez votre nom pour signer"); return; }
    if (action === "REFUSER" && !motifRefus.trim()) { toast.error("Précisez le motif du refus"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/offres/${token}/repondre`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, nomSignataire, motifRefus }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success(action === "ACCEPTER" ? "Offre acceptée" : "Offre refusée"); charger(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (error || !data) return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6"><p className="text-slate-500 text-sm text-center">{error ?? "Lien invalide"}</p></div>;

  const label = data.type === "PROFORMA" ? "Facture proforma" : "Devis";
  const repondable = data.statut === "ENVOYE" || data.statut === "BROUILLON";

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div className="text-center">
          <FileText className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
          <h1 className="text-lg font-bold text-slate-900">{label} {data.reference}</h1>
          <p className="text-xs text-slate-500">{data.pointDeVenteNom} · {data.clientNom}</p>
          {repondable && <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Valable jusqu&apos;au {new Date(data.dateValidite).toLocaleDateString("fr-FR")}</p>}
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {data.lignes.map((l, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{l.produitNom}</td>
                  <td className="text-center px-3 py-2">× {l.quantite}</td>
                  <td className="text-right px-3 py-2 font-medium">{fmt(l.totalLigne)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-right space-y-0.5">
          {data.totalRemise > 0 && <p className="text-xs text-amber-600">Remise : -{fmt(data.totalRemise)} FCFA</p>}
          <p className="text-sm font-bold text-slate-800">Total TTC : {fmt(data.totalTTC)} FCFA</p>
        </div>
        {data.conditions && <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">{data.conditions}</p>}

        {data.statut === "EXPIRE" ? (
          <p className="text-center text-sm text-red-600 py-4">Cette offre a expiré.</p>
        ) : data.statut === "ACCEPTE" ? (
          <div className="text-center py-4"><CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-1" /><p className="text-sm font-semibold text-emerald-700">Accepté par {data.nomSignataireReponse}</p></div>
        ) : data.statut === "REFUSE" ? (
          <div className="text-center py-4"><XCircle className="w-7 h-7 text-red-500 mx-auto mb-1" /><p className="text-sm font-semibold text-red-600">Refusé</p><p className="text-xs text-slate-500">{data.motifRefus}</p></div>
        ) : (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {showRefus ? (
              <>
                <textarea value={motifRefus} onChange={(e) => setMotifRefus(e.target.value)} placeholder="Motif du refus" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <button onClick={() => repondre("REFUSER")} disabled={saving} className="w-full px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50">Confirmer le refus</button>
              </>
            ) : (
              <>
                <input value={nomSignataire} onChange={(e) => setNomSignataire(e.target.value)} placeholder="Votre nom (signature)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <button onClick={() => repondre("ACCEPTER")} disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} J&apos;accepte cette offre
                </button>
                <button onClick={() => setShowRefus(true)} className="w-full px-4 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50">Refuser</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
