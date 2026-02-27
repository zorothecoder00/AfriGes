"use client";

import React, { useState } from "react";
import { ArrowLeft, Send, MessageSquare, ChevronDown, ChevronUp, Clock, Smile } from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDateTime } from "@/lib/format";

const EMOJIS = ["👋","😊","✅","❌","⚠️","📦","💰","📝","🔔","👍","👎","🎉","📊","🤝","💬","📞","✉️","🕐","🔍","📋","💡","🚀","✨","🙏","😅","🤔","👏","🎯","📈","📉"];

function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
        title="Emojis"
      >
        <Smile size={16} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-10 w-64 flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { onPick(e); setOpen(false); }}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 rounded-lg transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface MessageOriginal {
  id: number;
  sujet: string;
  contenu: string;
  lu: boolean;
  createdAt: string;
  expediteur: { id: number; nom: string; prenom: string; email: string };
  reponses: {
    id: number;
    contenu: string;
    createdAt: string;
    expediteur: { id: number; nom: string; prenom: string };
  }[];
}

interface MessagesResponse {
  success: boolean;
  data: MessageOriginal[];
  meta: { total: number; page: number; totalPages: number; nonLus: number };
}

function MessageCard({ message, onReplied }: { message: MessageOriginal; onReplied: () => void }) {
  const [open, setOpen]         = useState(!message.lu); // auto-ouvrir si non lu
  const [replyText, setReplyText] = useState("");

  const { mutate: sendReply, loading } = useMutation(
    `/api/admin/messages/${message.id}/reply`,
    "POST",
    { successMessage: "Réponse envoyée !" }
  );

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    const result = await sendReply({ contenu: replyText.trim() });
    if (result) {
      setReplyText("");
      onReplied();
    }
  };

  const hasReplied = message.reponses.some(
    (r) => r.expediteur.id !== message.expediteur.id
  );

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
      !message.lu ? "border-emerald-300 shadow-emerald-50" : "border-slate-200/60"
    }`}>
      {/* En-tête */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-6 py-5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {message.expediteur.prenom[0]}{message.expediteur.nom[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-800 text-sm">
                  {message.expediteur.prenom} {message.expediteur.nom}
                </p>
                {!message.lu && (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full uppercase tracking-wide">
                    Nouveau
                  </span>
                )}
              </div>
              <p className="font-medium text-slate-700 mt-0.5">{message.sujet}</p>
              <p className="text-sm text-slate-400 truncate mt-0.5">{message.contenu}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {hasReplied && (
              <span className="text-xs font-medium px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full">
                Répondu
              </span>
            )}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock size={12} />
              {formatDateTime(message.createdAt)}
            </div>
            {open
              ? <ChevronUp size={16} className="text-slate-400" />
              : <ChevronDown size={16} className="text-slate-400" />
            }
          </div>
        </div>
      </button>

      {/* Contenu déplié */}
      {open && (
        <div className="border-t border-slate-100 px-6 py-5 space-y-5">
          {/* Message de l'admin */}
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{message.contenu}</p>
          </div>

          {/* Fil des réponses */}
          {message.reponses.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Échanges
              </p>
              {message.reponses.map((rep) => {
                const isAdmin = rep.expediteur.id === message.expediteur.id;
                return (
                  <div key={rep.id} className={`flex gap-3 ${isAdmin ? "" : "flex-row-reverse"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${
                      isAdmin
                        ? "bg-gradient-to-br from-slate-700 to-slate-800"
                        : "bg-gradient-to-br from-emerald-500 to-emerald-600"
                    }`}>
                      {rep.expediteur.prenom[0]}{rep.expediteur.nom[0]}
                    </div>
                    <div className={`flex-1 rounded-xl p-3 ${isAdmin ? "bg-slate-100" : "bg-emerald-50"}`}>
                      <div className={`flex items-center justify-between mb-1 ${isAdmin ? "" : "flex-row-reverse"}`}>
                        <p className={`text-xs font-semibold ${isAdmin ? "text-slate-700" : "text-emerald-700"}`}>
                          {rep.expediteur.prenom} {rep.expediteur.nom}
                        </p>
                        <p className="text-xs text-slate-400">{formatDateTime(rep.createdAt)}</p>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{rep.contenu}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Zone de réponse */}
          <form onSubmit={handleReply} className="space-y-2">
            <textarea
              rows={2}
              placeholder="Écrire une réponse à l'admin…"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 resize-none"
            />
            <div className="flex items-center justify-between">
              <EmojiPicker onPick={(e) => setReplyText((t) => t + e)} />
              <button
                type="submit"
                disabled={loading || !replyText.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={14} />
                {loading ? "…" : "Répondre"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function GestionnaireMessagesPage() {
  const [page, setPage] = useState(1);

  const { data: response, loading, error, refetch } = useApi<MessagesResponse>(
    `/api/gestionnaire/messages?page=${page}&limit=20`
  );

  const messages = response?.data ?? [];
  const meta     = response?.meta;

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Chargement des messages…</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/20 p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard/user" className="p-2 hover:bg-white rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-800">Mes messages</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {meta?.total ?? 0} message{(meta?.total ?? 0) > 1 ? "s" : ""} reçu{(meta?.total ?? 0) > 1 ? "s" : ""}
              {(meta?.nonLus ?? 0) > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                  {meta!.nonLus} non lu{meta!.nonLus > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Liste */}
        {messages.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200/60 text-center">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Aucun message reçu</p>
            <p className="text-slate-400 text-sm mt-1">L&apos;admin vous contactera ici.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageCard key={msg.id} message={msg} onReplied={refetch} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-2xl px-6 py-4 shadow-sm border border-slate-200/60">
            <p className="text-sm text-slate-600">
              Page <span className="font-semibold">{meta.page}</span> sur{" "}
              <span className="font-semibold">{meta.totalPages}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
