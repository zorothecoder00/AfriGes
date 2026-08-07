"use client";

import { useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { Loader2, Send, Users } from "lucide-react";

interface MessageItem { id: number; contenu: string; createdAt: string; auteur: { id: number; nom: string; prenom: string } }

/** Fil de discussion interne de l'équipe marketing (CDC §21 "Messages internes") — pas de DM, un canal d'équipe partagé. */
export default function MessagesInternes() {
  const { data: res, loading, refetch } = useApi<{ data: MessageItem[] }>("/api/admin/marketing/messages-internes");
  const [texte, setTexte] = useState("");
  const { mutate: envoyer, loading: envoi } = useMutation<{ id: number }, { contenu: string }>(
    "/api/admin/marketing/messages-internes", "POST"
  );

  const submit = async () => {
    if (!texte.trim()) return;
    if (await envoyer({ contenu: texte })) { setTexte(""); refetch(); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 flex flex-col h-[520px]">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Users className="w-4 h-4 text-fuchsia-600" />
        <p className="text-sm font-semibold text-slate-800">Équipe marketing</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && !res ? (
          <div className="flex items-center justify-center h-full text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (res?.data ?? []).length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">Aucun message pour l&apos;instant — lancez la discussion.</p>
        ) : res!.data.map((m) => (
          <div key={m.id} className="bg-slate-50 rounded-xl px-3 py-2">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-xs font-semibold text-slate-700">{m.auteur.prenom} {m.auteur.nom}</p>
              <p className="text-[10px] text-slate-400">{formatDate(m.createdAt)}</p>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{m.contenu}</p>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-slate-100 flex items-center gap-2">
        <input value={texte} onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Écrire un message à l'équipe…"
          className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm" />
        <button onClick={submit} disabled={envoi || !texte.trim()}
          className="p-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-xl">
          {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
