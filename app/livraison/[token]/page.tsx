"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { PackageCheck, Loader2, CheckCircle2, AlertTriangle, MapPin } from "lucide-react";

interface Ligne { produitId: number; produitNom: string; quantiteCommandee: number; quantiteLivree: number }
interface LivraisonData {
  reference: string; statut: string;
  clientNom: string; clientAdresse: string | null;
  pointDeVenteNom: string; commandeReference: string;
  lignes: Ligne[];
  etatMarchandise: string | null; reserve: string | null;
  signatureClientNom: string | null; dateSignatureClient: string | null;
}

export default function LivraisonConfirmationPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<LivraisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quantites, setQuantites] = useState<Record<number, string>>({});
  const [etatMarchandise, setEtatMarchandise] = useState<"CONFORME" | "NON_CONFORME">("CONFORME");
  const [reserve, setReserve] = useState("");
  const [signatureClientNom, setSignatureClientNom] = useState("");
  const [confirme, setConfirme] = useState(false);
  const [saving, setSaving] = useState(false);

  const charger = () => {
    fetch(`/api/livraison/${token}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Erreur");
        const d = j.data as LivraisonData;
        setData(d);
        setQuantites(Object.fromEntries(d.lignes.map((l) => [l.produitId, String(l.quantiteLivree)])));
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  };
  useEffect(charger, [token]);

  const aUnEcart = data?.lignes.some((l) => Number(quantites[l.produitId]) !== l.quantiteCommandee) ?? false;

  const confirmer = async () => {
    if (!signatureClientNom.trim()) { toast.error("Indiquez votre nom pour signer"); return; }
    if ((etatMarchandise === "NON_CONFORME" || aUnEcart) && !reserve.trim()) { toast.error("Précisez la réserve / le motif de l'écart"); return; }

    setSaving(true);
    try {
      let latitude: number | undefined, longitude: number | undefined;
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => { latitude = pos.coords.latitude; longitude = pos.coords.longitude; resolve(); },
            () => resolve(),
            { timeout: 3000 }
          );
        });
      }
      const r = await fetch(`/api/livraison/${token}/confirmer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lignes: data!.lignes.map((l) => ({ produitId: l.produitId, quantiteLivree: Number(quantites[l.produitId]) || 0 })),
          etatMarchandise, reserve: reserve || undefined, signatureClientNom, latitude, longitude,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Réception confirmée"); setConfirme(true); charger(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-slate-500 text-sm text-center">{error ?? "Lien invalide"}</p>
      </div>
    );
  }

  const dejaConfirme = data.statut !== "EN_ATTENTE_SIGNATURE";

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div className="text-center">
          <PackageCheck className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
          <h1 className="text-lg font-bold text-slate-900">Confirmation de livraison</h1>
          <p className="text-xs text-slate-500">{data.commandeReference} · {data.pointDeVenteNom}</p>
        </div>

        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-sm font-semibold text-slate-800">{data.clientNom}</p>
          {data.clientAdresse && <p className="text-xs text-slate-500">{data.clientAdresse}</p>}
        </div>

        {(dejaConfirme || confirme) ? (
          <div className="text-center py-6 space-y-2">
            {data.statut === "LITIGE" ? (
              <>
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-sm font-semibold text-amber-700">Réserve enregistrée</p>
                <p className="text-xs text-slate-500">{data.reserve}</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-sm font-semibold text-emerald-700">Réception confirmée</p>
              </>
            )}
            <p className="text-xs text-slate-400">Signé par {data.signatureClientNom}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase">Marchandise reçue</p>
              {data.lignes.map((l) => (
                <div key={l.produitId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex-1 truncate">{l.produitNom}</span>
                  <span className="text-xs text-slate-400">commandé {l.quantiteCommandee}</span>
                  <input type="number" min="0" max={l.quantiteCommandee} value={quantites[l.produitId] ?? ""}
                    onChange={(e) => setQuantites((prev) => ({ ...prev, [l.produitId]: e.target.value }))}
                    className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center" />
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">État de la marchandise</p>
              <div className="flex gap-2">
                <button onClick={() => setEtatMarchandise("CONFORME")} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${etatMarchandise === "CONFORME" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"}`}>Conforme</button>
                <button onClick={() => setEtatMarchandise("NON_CONFORME")} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${etatMarchandise === "NON_CONFORME" ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-600 border-slate-200"}`}>Non conforme</button>
              </div>
            </div>

            {(etatMarchandise === "NON_CONFORME" || aUnEcart) && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Réserve / observations (obligatoire)</p>
                <textarea value={reserve} onChange={(e) => setReserve(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Votre nom (signature électronique)</p>
              <input value={signatureClientNom} onChange={(e) => setSignatureClientNom(e.target.value)} placeholder="Nom et prénom" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Votre position pourra être enregistrée avec la confirmation.</p>
            </div>

            <button onClick={confirmer} disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Je confirme la réception
            </button>
          </>
        )}
      </div>
    </div>
  );
}
