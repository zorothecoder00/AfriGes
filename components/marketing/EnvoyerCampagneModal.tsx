"use client";

import { useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { X, Send, Loader2, Eye, CheckCircle2, XCircle, ShieldOff, Clock3 } from "lucide-react";

interface ModeleItem { id: number; nom: string; canal: { id: number; code: string; libelle: string } }
interface ResultatEnvoi { total: number; envoyes: number; echecs: number; bloquesConsentement: number; bloquesFrequence: number }

export default function EnvoyerCampagneModal({ campagneId, onClose }: { campagneId: number; onClose: () => void }) {
  const { data: modelesRes } = useApi<{ data: ModeleItem[] }>("/api/admin/marketing/modeles");
  const [modeleId, setModeleId] = useState("");
  const [apercu, setApercu] = useState<{ type: string; texte?: string; html?: string; objet?: string } | null>(null);
  const [resultat, setResultat] = useState<ResultatEnvoi | null>(null);

  const previewIdRef = useRef(0);
  const { mutate: previsualiser, loading: previewing } = useMutation<{ type: string; texte?: string; html?: string; objet?: string }, { clientId: number }>(
    () => `/api/admin/marketing/modeles/${previewIdRef.current}/previsualiser`, "POST"
  );
  const { mutate: envoyer, loading: sending } = useMutation<ResultatEnvoi, { modeleMessageId: number; canalId: number }>(
    `/api/admin/marketing/campagnes/${campagneId}/envoyer`, "POST",
    { invalidate: [`/api/admin/marketing/campagnes/${campagneId}`, "/api/admin/marketing/envois"] }
  );

  const { data: campagneRes } = useApi<{ data: { audience: { membres: { clientId: number }[] } | null } }>(`/api/admin/marketing/campagnes/${campagneId}`);
  const clientEchantillon = campagneRes?.data.audience?.membres?.[0]?.clientId;

  const modele = (modelesRes?.data ?? []).find((m) => String(m.id) === modeleId);

  const faireApercu = async () => {
    if (!modele || !clientEchantillon) return;
    previewIdRef.current = modele.id;
    const res = await previsualiser({ clientId: clientEchantillon });
    if (res) setApercu(res);
  };

  const confirmer = async () => {
    if (!modele) return;
    const res = await envoyer({ modeleMessageId: modele.id, canalId: modele.canal.id });
    if (res) setResultat(res);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[170] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-bold text-slate-900">Envoyer à l&apos;audience</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
          {resultat ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div><p className="text-lg font-bold text-emerald-700">{resultat.envoyes}</p><p className="text-xs text-emerald-600">Envoyés</p></div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <div><p className="text-lg font-bold text-red-700">{resultat.echecs}</p><p className="text-xs text-red-600">Échecs</p></div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2">
                  <ShieldOff className="w-5 h-5 text-slate-500" />
                  <div><p className="text-lg font-bold text-slate-700">{resultat.bloquesConsentement}</p><p className="text-xs text-slate-500">Bloqués (consentement)</p></div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                  <Clock3 className="w-5 h-5 text-amber-600" />
                  <div><p className="text-lg font-bold text-amber-700">{resultat.bloquesFrequence}</p><p className="text-xs text-amber-600">Bloqués (fréquence)</p></div>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center">Sur {resultat.total} client(s) dans l&apos;audience. Détail dans le journal (Communication → Journal).</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Modèle de message</label>
                <select value={modeleId} onChange={(e) => { setModeleId(e.target.value); setApercu(null); }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                  <option value="">—</option>
                  {(modelesRes?.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.nom} ({m.canal.libelle})</option>)}
                </select>
              </div>

              {modele && clientEchantillon && (
                <button onClick={faireApercu} disabled={previewing}
                  className="flex items-center gap-1.5 text-xs font-medium text-fuchsia-600 hover:text-fuchsia-700">
                  {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Aperçu sur un client de l&apos;audience
                </button>
              )}
              {apercu && (
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs">
                  {apercu.type === "EMAIL" ? (
                    <>
                      <p className="font-semibold text-slate-700 mb-1">Objet : {apercu.objet}</p>
                      <div className="bg-white border border-slate-100 rounded p-2 max-h-40 overflow-y-auto" dangerouslySetInnerHTML={{ __html: apercu.html ?? "" }} />
                    </>
                  ) : (
                    <p className="text-slate-700 whitespace-pre-wrap">{apercu.texte}</p>
                  )}
                </div>
              )}
              {modele && !clientEchantillon && (
                <p className="text-xs text-amber-600">Cette campagne n&apos;a pas encore d&apos;audience avec des membres — aucun envoi possible.</p>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            {resultat ? "Fermer" : "Annuler"}
          </button>
          {!resultat && (
            <button onClick={confirmer} disabled={sending || !modele}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 disabled:opacity-50 font-medium">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Envoyer à l&apos;audience
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
