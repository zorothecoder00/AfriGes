"use client";

import React, { useState } from "react";
import { X, Send, Search } from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";

interface Gestionnaire {
  id: number;
  role: string;
  member: { id: number; nom: string; prenom: string; email: string };
}

interface GestionnairesResponse {
  data: Gestionnaire[];
}

interface Props {
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  RESPONSABLE_POINT_DE_VENTE:         "Resp. PDV",
  CAISSIER:                           "Caissier",
  MAGAZINIER:                         "Magasinier",
  AGENT_LOGISTIQUE_APPROVISIONNEMENT: "Agent logistique",
  COMPTABLE:                          "Comptable",
  COMMERCIAL:                         "Commercial",
  AGENT_TERRAIN:                      "Agent terrain",
  CONTROLEUR_TERRAIN:                 "Contrôleur terrain",
  RESPONSABLE_VENTE_CREDIT:           "Resp. vente crédit",
  AUDITEUR_INTERNE:                   "Auditeur interne",
  RESPONSABLE_COMMUNAUTE:             "Resp. communauté",
  RESPONSABLE_ECONOMIQUE:             "Resp. économique",
  RESPONSABLE_MARKETING:              "Resp. marketing",
  REVENDEUR:                          "Revendeur",
  ACTIONNAIRE:                        "Actionnaire",
};

export default function MessageModal({ onClose }: Props) {
  const [search, setSearch]             = useState("");
  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [sujet, setSujet]               = useState("");
  const [contenu, setContenu]           = useState("");

  const { data: response } = useApi<GestionnairesResponse>(
    "/api/admin/gestionnaires?limit=200&actif=true"
  );

  const { mutate: sendMessage, loading } = useMutation(
    "/api/admin/messages",
    "POST",
    { successMessage: "Message envoyé avec succès !" }
  );

  const gestionnaires = (response?.data ?? []).filter((g) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      g.member.prenom.toLowerCase().includes(q) ||
      g.member.nom.toLowerCase().includes(q) ||
      g.member.email.toLowerCase().includes(q)
    );
  });

  const selected = gestionnaires.find((g) => g.member.id === selectedId) ??
    (response?.data ?? []).find((g) => g.member.id === selectedId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;

    const result = await sendMessage({
      destinataireId: selectedId,
      sujet:          sujet.trim(),
      contenu:        contenu.trim(),
    });

    if (result) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Nouveau message</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Sélection du destinataire */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Destinataire</label>

              {selected ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">
                      {selected.member.prenom} {selected.member.nom}
                    </p>
                    <p className="text-xs text-slate-500">{ROLE_LABELS[selected.role] ?? selected.role}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedId(null); setSearch(""); }}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Rechercher un gestionnaire…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    />
                  </div>
                  {search.trim() && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                      {gestionnaires.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-slate-400">Aucun résultat</p>
                      ) : (
                        gestionnaires.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => { setSelectedId(g.member.id); setSearch(""); }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                          >
                            <p className="font-medium text-slate-800 text-sm">
                              {g.member.prenom} {g.member.nom}
                            </p>
                            <p className="text-xs text-slate-400">
                              {ROLE_LABELS[g.role] ?? g.role} · {g.member.email}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sujet */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Sujet</label>
              <input
                required
                type="text"
                placeholder="Objet du message…"
                value={sujet}
                onChange={(e) => setSujet(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>

            {/* Contenu */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Message</label>
              <textarea
                required
                rows={5}
                placeholder="Écrivez votre message…"
                value={contenu}
                onChange={(e) => setContenu(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all font-medium text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !selectedId || !sujet.trim() || !contenu.trim()}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
              {loading ? "Envoi…" : "Envoyer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
