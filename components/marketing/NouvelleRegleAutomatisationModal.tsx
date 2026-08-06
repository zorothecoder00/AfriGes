"use client";

import { useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { X, Plus, Loader2, Trash2, ArrowUp, ArrowDown } from "lucide-react";

interface CanalMarketing { id: number; code: string; libelle: string; actif: boolean }
interface ModeleMessage { id: number; nom: string; canalId: number }
interface CampagneOption { id: number; nom: string }
interface Reference {
  utilisateurs: { id: number; nom: string; prenom: string }[];
  tags: { id: number; nom: string }[];
}

export const DECLENCHEUR_LABEL: Record<string, string> = {
  NOUVEAU_CLIENT: "Nouveau client",
  PREMIER_ACHAT: "Premier achat",
  ACHAT_PRODUIT: "Achat d'un produit",
  PANIER_ELEVE: "Panier élevé",
  CLIENT_INACTIF: "Client inactif",
  ANNIVERSAIRE: "Anniversaire du client",
};

export const ACTION_LABEL: Record<string, string> = {
  ENVOYER_SMS: "Envoyer un SMS",
  ENVOYER_EMAIL: "Envoyer un email",
  ENVOYER_WHATSAPP: "Envoyer un WhatsApp",
  NOTIFICATION_INTERNE: "Notifier l'équipe",
  ATTRIBUER_COMMERCIAL: "Attribuer un commercial",
  CREER_TACHE: "Créer une tâche",
  AJOUTER_TAG: "Ajouter un tag",
  RETIRER_TAG: "Retirer un tag",
  ATTRIBUER_POINTS: "Attribuer des points fidélité",
  DECLENCHER_CAMPAGNE: "Ajouter à une campagne",
};

const CANAL_CODE_PAR_ACTION: Record<string, string> = {
  ENVOYER_SMS: "SMS", ENVOYER_EMAIL: "EMAIL", ENVOYER_WHATSAPP: "WHATSAPP",
};

interface EtapeForm {
  delaiJours: string;
  action: string;
  params: Record<string, string>;
  arreterSiAchatEntreTemps: boolean;
}

const ETAPE_VIDE: EtapeForm = { delaiJours: "0", action: "ENVOYER_SMS", params: {}, arreterSiAchatEntreTemps: false };

/** Constructeur de règle d'automatisation (CDC §16-19) — liste d'étapes, pattern Email Builder (Phase 2). */
export default function NouvelleRegleAutomatisationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: canauxRes } = useApi<{ data: CanalMarketing[] }>("/api/admin/marketing/canaux");
  const { data: modelesRes } = useApi<{ data: ModeleMessage[] }>("/api/admin/marketing/modeles");
  const { data: campagnesRes } = useApi<{ data: CampagneOption[] }>("/api/admin/marketing/campagnes");
  const { data: refRes } = useApi<{ data: Reference }>("/api/admin/marketing/reference");
  const { mutate: creer, loading: creating } = useMutation<{ id: number }, Record<string, unknown>>(
    "/api/admin/marketing/regles", "POST",
    { successMessage: "Règle d'automatisation créée", invalidate: "/api/admin/marketing/regles" }
  );

  const [form, setForm] = useState({ nom: "", description: "", declencheur: "" });
  const [declParams, setDeclParams] = useState<Record<string, string>>({});
  const [etapes, setEtapes] = useState<EtapeForm[]>([{ ...ETAPE_VIDE }]);

  const setField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const majEtape = (i: number, patch: Partial<EtapeForm>) =>
    setEtapes((list) => list.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const majParamEtape = (i: number, cle: string, valeur: string) =>
    setEtapes((list) => list.map((e, idx) => (idx === i ? { ...e, params: { ...e.params, [cle]: valeur } } : e)));
  const deplacerEtape = (i: number, sens: -1 | 1) =>
    setEtapes((list) => {
      const j = i + sens;
      if (j < 0 || j >= list.length) return list;
      const copie = [...list];
      [copie[i], copie[j]] = [copie[j], copie[i]];
      return copie;
    });
  const supprimerEtape = (i: number) => setEtapes((list) => list.filter((_, idx) => idx !== i));

  const canModeles = (codeCanal: string) => {
    const canal = (canauxRes?.data ?? []).find((c) => c.code === codeCanal);
    if (!canal) return [];
    return (modelesRes?.data ?? []).filter((m) => m.canalId === canal.id);
  };

  const submit = async () => {
    if (!form.nom || !form.declencheur || etapes.length === 0) return;

    const etapesPayload = etapes.map((e) => {
      let actionParams: Record<string, unknown> = {};
      if (e.action in CANAL_CODE_PAR_ACTION) {
        const codeCanal = CANAL_CODE_PAR_ACTION[e.action];
        const canal = (canauxRes?.data ?? []).find((c) => c.code === codeCanal);
        actionParams = { canalId: canal?.id, modeleMessageId: e.params.modeleMessageId ? Number(e.params.modeleMessageId) : undefined };
      } else if (e.action === "NOTIFICATION_INTERNE") {
        actionParams = { titre: e.params.titre, message: e.params.message };
      } else if (e.action === "ATTRIBUER_COMMERCIAL") {
        actionParams = { agentId: e.params.agentId ? Number(e.params.agentId) : undefined };
      } else if (e.action === "CREER_TACHE") {
        actionParams = {
          assigneAId: e.params.assigneAId ? Number(e.params.assigneAId) : undefined,
          titre: e.params.titre, description: e.params.description || undefined,
          delaiJoursEcheance: e.params.delaiJoursEcheance ? Number(e.params.delaiJoursEcheance) : undefined,
        };
      } else if (e.action === "AJOUTER_TAG" || e.action === "RETIRER_TAG") {
        actionParams = { tagId: e.params.tagId ? Number(e.params.tagId) : undefined };
      } else if (e.action === "ATTRIBUER_POINTS") {
        actionParams = { points: e.params.points ? Number(e.params.points) : undefined, motif: e.params.motif };
      } else if (e.action === "DECLENCHER_CAMPAGNE") {
        actionParams = { campagneId: e.params.campagneId ? Number(e.params.campagneId) : undefined };
      }
      return {
        delaiJours: Number(e.delaiJours || 0),
        action: e.action,
        actionParams,
        arreterSiAchatEntreTemps: e.arreterSiAchatEntreTemps,
      };
    });

    const declencheurParams: Record<string, unknown> = {};
    if (form.declencheur === "ACHAT_PRODUIT" && declParams.produitId) declencheurParams.produitId = Number(declParams.produitId);
    if (form.declencheur === "PANIER_ELEVE" && declParams.montantMin) declencheurParams.montantMin = Number(declParams.montantMin);
    if (form.declencheur === "CLIENT_INACTIF") declencheurParams.seuilJours = Number(declParams.seuilJours || 30);

    const res = await creer({
      nom: form.nom, description: form.description || undefined,
      declencheur: form.declencheur, declencheurParams,
      etapes: etapesPayload,
    });
    if (res) onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[160] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-bold text-slate-900">Nouvelle règle d&apos;automatisation</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-5 flex-1 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom *</label>
            <input value={form.nom} onChange={setField("nom")} placeholder="Ex: Séquence bienvenue nouveau client"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={setField("description")} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Déclencheur *</label>
              <select value={form.declencheur} onChange={(e) => { setForm((f) => ({ ...f, declencheur: e.target.value })); setDeclParams({}); }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">—</option>
                {Object.entries(DECLENCHEUR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {form.declencheur === "ACHAT_PRODUIT" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Produit</label>
                <input value={declParams.produitId ?? ""} onChange={(e) => setDeclParams((p) => ({ ...p, produitId: e.target.value }))}
                  placeholder="ID produit" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            )}
            {form.declencheur === "PANIER_ELEVE" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Montant minimum (FCFA)</label>
                <input type="number" value={declParams.montantMin ?? ""} onChange={(e) => setDeclParams((p) => ({ ...p, montantMin: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            )}
            {form.declencheur === "CLIENT_INACTIF" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Seuil d&apos;inactivité (jours)</label>
                <input type="number" value={declParams.seuilJours ?? "30"} onChange={(e) => setDeclParams((p) => ({ ...p, seuilJours: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-800">Étapes de la séquence</h4>
              <button onClick={() => setEtapes((l) => [...l, { ...ETAPE_VIDE }])}
                className="flex items-center gap-1 text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-700">
                <Plus className="w-3.5 h-3.5" /> Ajouter une étape
              </button>
            </div>

            <div className="space-y-3">
              {etapes.map((etape, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-700 text-[11px] font-bold shrink-0">{i + 1}</span>
                    <input type="number" value={etape.delaiJours} onChange={(e) => majEtape(i, { delaiJours: e.target.value })}
                      className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                    <span className="text-xs text-slate-500 shrink-0">jour(s) après {i === 0 ? "l'inscription" : "l'étape précédente"}</span>
                    <div className="flex-1" />
                    <button onClick={() => deplacerEtape(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deplacerEtape(i, 1)} disabled={i === etapes.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => supprimerEtape(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>

                  <select value={etape.action} onChange={(e) => majEtape(i, { action: e.target.value, params: {} })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                    {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>

                  {etape.action in CANAL_CODE_PAR_ACTION && (
                    <select value={etape.params.modeleMessageId ?? ""} onChange={(e) => majParamEtape(i, "modeleMessageId", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                      <option value="">Modèle de message —</option>
                      {canModeles(CANAL_CODE_PAR_ACTION[etape.action]).map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                    </select>
                  )}

                  {etape.action === "NOTIFICATION_INTERNE" && (
                    <div className="grid grid-cols-2 gap-2">
                      <input value={etape.params.titre ?? ""} onChange={(e) => majParamEtape(i, "titre", e.target.value)} placeholder="Titre"
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                      <input value={etape.params.message ?? ""} onChange={(e) => majParamEtape(i, "message", e.target.value)} placeholder="Message ({{prenom}}, {{nom}}…)"
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                  )}

                  {etape.action === "ATTRIBUER_COMMERCIAL" && (
                    <select value={etape.params.agentId ?? ""} onChange={(e) => majParamEtape(i, "agentId", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                      <option value="">Commercial —</option>
                      {(refRes?.data.utilisateurs ?? []).map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                    </select>
                  )}

                  {etape.action === "CREER_TACHE" && (
                    <div className="grid grid-cols-2 gap-2">
                      <select value={etape.params.assigneAId ?? ""} onChange={(e) => majParamEtape(i, "assigneAId", e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                        <option value="">Assigné à —</option>
                        {(refRes?.data.utilisateurs ?? []).map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                      </select>
                      <input type="number" value={etape.params.delaiJoursEcheance ?? ""} onChange={(e) => majParamEtape(i, "delaiJoursEcheance", e.target.value)}
                        placeholder="Échéance (jours)" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                      <input value={etape.params.titre ?? ""} onChange={(e) => majParamEtape(i, "titre", e.target.value)} placeholder="Titre de la tâche"
                        className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                      <input value={etape.params.description ?? ""} onChange={(e) => majParamEtape(i, "description", e.target.value)} placeholder="Description"
                        className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                  )}

                  {(etape.action === "AJOUTER_TAG" || etape.action === "RETIRER_TAG") && (
                    <select value={etape.params.tagId ?? ""} onChange={(e) => majParamEtape(i, "tagId", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                      <option value="">Tag —</option>
                      {(refRes?.data.tags ?? []).map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                    </select>
                  )}

                  {etape.action === "ATTRIBUER_POINTS" && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={etape.params.points ?? ""} onChange={(e) => majParamEtape(i, "points", e.target.value)} placeholder="Points"
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                      <input value={etape.params.motif ?? ""} onChange={(e) => majParamEtape(i, "motif", e.target.value)} placeholder="Motif"
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                  )}

                  {etape.action === "DECLENCHER_CAMPAGNE" && (
                    <select value={etape.params.campagneId ?? ""} onChange={(e) => majParamEtape(i, "campagneId", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                      <option value="">Campagne —</option>
                      {(campagnesRes?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                  )}

                  <label className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                    <input type="checkbox" checked={etape.arreterSiAchatEntreTemps}
                      onChange={(e) => majEtape(i, { arreterSiAchatEntreTemps: e.target.checked })} />
                    Arrêter la séquence si le client a acheté entre-temps
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={creating || !form.nom || !form.declencheur}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 disabled:opacity-50 font-medium">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}
