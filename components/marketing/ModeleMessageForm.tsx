"use client";

import { useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { X, Plus, Loader2, Trash2, ChevronUp, ChevronDown } from "lucide-react";

export type BlocEmailForm =
  | { type: "TEXTE"; contenu: string }
  | { type: "IMAGE"; url: string; alt?: string }
  | { type: "BOUTON"; texte: string; url: string }
  | { type: "PRODUIT"; produitId: number }
  | { type: "PROMOTION"; promotionId: number }
  | { type: "LIEN"; texte: string; url: string };

interface CanalMarketing { id: number; code: string; libelle: string; actif: boolean }
interface Reference { produits: { id: number; nom: string }[]; utilisateurs: { id: number; nom: string; prenom: string }[] }

const CATEGORIES = [
  ["BIENVENUE", "Bienvenue"], ["CONFIRMATION", "Confirmation"], ["PROMOTION", "Promotion"], ["RELANCE", "Relance"],
  ["FIDELISATION", "Fidélisation"], ["ANNIVERSAIRE", "Anniversaire"], ["REACTIVATION", "Réactivation"],
  ["NOUVEAU_PRODUIT", "Nouveau produit"], ["EVENEMENT", "Événement"], ["REMERCIEMENT", "Remerciement"],
  ["ENQUETE_SATISFACTION", "Enquête satisfaction"], ["AUTRE", "Autre"],
] as const;

const VARIABLES = ["prenom", "nom", "agence", "dernier_achat", "montant", "points_fidelite", "date"];

const BLOC_LABEL: Record<BlocEmailForm["type"], string> = {
  TEXTE: "Texte", IMAGE: "Image", BOUTON: "Bouton", PRODUIT: "Produit", PROMOTION: "Promotion", LIEN: "Lien",
};

function blocParDefaut(type: BlocEmailForm["type"]): BlocEmailForm {
  switch (type) {
    case "TEXTE": return { type, contenu: "" };
    case "IMAGE": return { type, url: "" };
    case "BOUTON": return { type, texte: "", url: "" };
    case "PRODUIT": return { type, produitId: 0 };
    case "PROMOTION": return { type, promotionId: 0 };
    case "LIEN": return { type, texte: "", url: "" };
  }
}

export default function ModeleMessageForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: canauxRes } = useApi<{ data: CanalMarketing[] }>("/api/admin/marketing/canaux");
  const { data: refRes } = useApi<{ data: Reference }>("/api/admin/marketing/reference");
  const { mutate: creer, loading: creating } = useMutation<{ id: number }, Record<string, unknown>>(
    "/api/admin/marketing/modeles", "POST",
    { successMessage: "Modèle créé", invalidate: "/api/admin/marketing/modeles" }
  );

  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState("PROMOTION");
  const [canalId, setCanalId] = useState("");
  const [objet, setObjet] = useState("");
  const [contenuTexte, setContenuTexte] = useState("");
  const [blocs, setBlocs] = useState<BlocEmailForm[]>([]);

  const canalChoisi = (canauxRes?.data ?? []).find((c) => String(c.id) === canalId);
  const estEmail = canalChoisi?.code === "EMAIL";

  const majBloc = (i: number, patch: Partial<BlocEmailForm>) =>
    setBlocs((prev) => prev.map((b, idx) => (idx === i ? ({ ...b, ...patch } as BlocEmailForm) : b)));
  const deplacerBloc = (i: number, direction: -1 | 1) =>
    setBlocs((prev) => {
      const next = [...prev];
      const j = i + direction;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const submit = async () => {
    if (!nom || !canalId) return;
    const res = await creer({
      nom, categorie, canalId: Number(canalId),
      objet: estEmail ? objet : undefined,
      contenuTexte: estEmail ? undefined : contenuTexte,
      contenuBlocs: estEmail ? blocs : undefined,
    });
    if (res) onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[160] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-bold text-slate-900">Nouveau modèle de message</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nom *</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex : Relance client inactif"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Catégorie</label>
              <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Canal *</label>
              <select value={canalId} onChange={(e) => setCanalId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">—</option>
                {(canauxRes?.data ?? []).filter((c) => c.actif).map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
              </select>
            </div>
          </div>

          {canalId && !estEmail && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contenu du message</label>
              <textarea value={contenuTexte} onChange={(e) => setContenuTexte(e.target.value)} rows={4}
                placeholder="Bonjour {{prenom}}, votre agence {{agence}} vous réserve une offre spéciale…"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {VARIABLES.map((v) => (
                  <button key={v} type="button" onClick={() => setContenuTexte((t) => `${t}{{${v}}}`)}
                    className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-mono hover:bg-slate-200">
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {canalId && estEmail && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Objet de l&apos;email</label>
                <input value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="ex : {{prenom}}, une offre rien que pour vous"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>

              <div>
                <p className="text-xs font-medium text-slate-600 mb-1.5">Contenu (blocs)</p>
                <div className="space-y-2">
                  {blocs.map((b, i) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">{BLOC_LABEL[b.type]}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => deplacerBloc(i, -1)} className="text-slate-300 hover:text-slate-600"><ChevronUp className="w-4 h-4" /></button>
                          <button onClick={() => deplacerBloc(i, 1)} className="text-slate-300 hover:text-slate-600"><ChevronDown className="w-4 h-4" /></button>
                          <button onClick={() => setBlocs((prev) => prev.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      {b.type === "TEXTE" && (
                        <textarea value={b.contenu} onChange={(e) => majBloc(i, { contenu: e.target.value })} rows={2}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs resize-none" />
                      )}
                      {b.type === "IMAGE" && (
                        <input value={b.url} onChange={(e) => majBloc(i, { url: e.target.value })} placeholder="URL de l'image"
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                      )}
                      {(b.type === "BOUTON" || b.type === "LIEN") && (
                        <div className="grid grid-cols-2 gap-2">
                          <input value={b.texte} onChange={(e) => majBloc(i, { texte: e.target.value })} placeholder="Texte"
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                          <input value={b.url} onChange={(e) => majBloc(i, { url: e.target.value })} placeholder="URL"
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                        </div>
                      )}
                      {b.type === "PRODUIT" && (
                        <select value={b.produitId || ""} onChange={(e) => majBloc(i, { produitId: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white">
                          <option value="">—</option>
                          {(refRes?.data.produits ?? []).map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                        </select>
                      )}
                      {b.type === "PROMOTION" && (
                        <input type="number" value={b.promotionId || ""} onChange={(e) => majBloc(i, { promotionId: Number(e.target.value) })}
                          placeholder="ID de la promotion (Catalogue)"
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(Object.keys(BLOC_LABEL) as BlocEmailForm["type"][]).map((t) => (
                    <button key={t} type="button" onClick={() => setBlocs((prev) => [...prev, blocParDefaut(t)])}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50">
                      <Plus className="w-3 h-3" /> {BLOC_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mt-1.5">
                <span className="text-[11px] text-slate-400 mr-1">Variables (objet) :</span>
                {VARIABLES.map((v) => (
                  <button key={v} type="button" onClick={() => setObjet((t) => `${t}{{${v}}}`)}
                    className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-mono hover:bg-slate-200">
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={creating || !nom || !canalId}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 disabled:opacity-50 font-medium">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}
