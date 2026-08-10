"use client";

import { useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { Plus, Loader2, MessageCircle, Bell, MessagesSquare, Share2, Settings, Smartphone, Mail } from "lucide-react";
import ModeleMessageForm, { type BlocEmailForm } from "@/components/marketing/ModeleMessageForm";
import MessagesInternes from "@/components/marketing/MessagesInternes";
import CalendrierEditorial from "@/components/marketing/CalendrierEditorial";

interface CanalMarketing { id: number; code: string; libelle: string; actif: boolean }
interface ModeleItem {
  id: number; nom: string; categorie: string; actif: boolean;
  canal: CanalMarketing; objet: string | null; contenuTexte: string | null; contenuBlocs: BlocEmailForm[] | null;
  creePar: { nom: string; prenom: string }; _count: { envois: number };
}
interface EnvoiItem {
  id: number; destinataire: string; statut: string; dateEnvoi: string; erreur: string | null; coutEstime: string | null;
  campagne: { code: string; nom: string } | null; canal: CanalMarketing;
  client: { nom: string; prenom: string }; modeleMessage: { nom: string } | null;
}
interface NotificationItem { id: number; titre: string; message: string; lue: boolean; createdAt: string; actionUrl: string | null }

const CATEGORIE_LABEL: Record<string, string> = {
  BIENVENUE: "Bienvenue", CONFIRMATION: "Confirmation", PROMOTION: "Promotion", RELANCE: "Relance",
  FIDELISATION: "Fidélisation", ANNIVERSAIRE: "Anniversaire", REACTIVATION: "Réactivation",
  NOUVEAU_PRODUIT: "Nouveau produit", EVENEMENT: "Événement", REMERCIEMENT: "Remerciement",
  ENQUETE_SATISFACTION: "Enquête satisfaction", AUTRE: "Autre",
};
const STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE: "bg-slate-100 text-slate-600", ENVOYE: "bg-emerald-100 text-emerald-700",
  ECHEC: "bg-red-100 text-red-700", LIVRE: "bg-blue-100 text-blue-700",
  LU: "bg-indigo-100 text-indigo-700", REPONSE: "bg-purple-100 text-purple-700",
};

/**
 * Centre de communication (CDC §21) : interface unique regroupant WhatsApp,
 * SMS, Email, Notifications, Messages internes et Réseaux sociaux. Partagé
 * admin/portail Responsable Marketing.
 */
type TabKey = "whatsapp" | "sms" | "email" | "notifications" | "messages" | "social" | "parametres";

const TABS: { key: TabKey; label: string; icon: typeof Bell }[] = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "sms", label: "SMS", icon: Smartphone },
  { key: "email", label: "Email", icon: Mail },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "messages", label: "Messages internes", icon: MessagesSquare },
  { key: "social", label: "Réseaux sociaux", icon: Share2 },
  { key: "parametres", label: "Paramètres", icon: Settings },
];

export default function CommunicationHub() {
  const [tab, setTab] = useState<TabKey>("whatsapp");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Communication</h2>
          <p className="text-slate-500 text-sm mt-0.5">Interface unique — WhatsApp, SMS, Email, notifications, messages internes, réseaux sociaux.</p>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-1 flex-wrap">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${tab === key ? "bg-white shadow-sm" : "text-slate-500"}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "whatsapp" && <CanalTab codeCanal="WHATSAPP" />}
      {tab === "sms" && <CanalTab codeCanal="SMS" />}
      {tab === "email" && <CanalTab codeCanal="EMAIL" />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "messages" && <MessagesInternes />}
      {tab === "social" && <CalendrierEditorial />}
      {tab === "parametres" && <Parametres />}
    </div>
  );
}

function CanalTab({ codeCanal }: { codeCanal: "WHATSAPP" | "SMS" | "EMAIL" }) {
  const [vue, setVue] = useState<"modeles" | "journal">("modeles");
  return (
    <div className="space-y-3">
      <div className="flex bg-slate-100 rounded-lg p-0.5 w-fit">
        <button onClick={() => setVue("modeles")} className={`px-3 py-1 text-[11px] font-semibold rounded-md ${vue === "modeles" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Modèles</button>
        <button onClick={() => setVue("journal")} className={`px-3 py-1 text-[11px] font-semibold rounded-md ${vue === "journal" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Journal</button>
      </div>
      {vue === "modeles" ? <Modeles codeCanal={codeCanal} /> : <Journal codeCanal={codeCanal} />}
    </div>
  );
}

function Modeles({ codeCanal }: { codeCanal: string }) {
  const { data: res, loading, refetch } = useApi<{ data: ModeleItem[] }>("/api/admin/marketing/modeles");
  const [modalOpen, setModalOpen] = useState(false);
  const modeles = (res?.data ?? []).filter((m) => m.canal.code === codeCanal);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700">
          <Plus size={16} /> Nouveau modèle
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading && !res ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : modeles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><MessageCircle className="w-8 h-8 mb-2" /><p>Aucun modèle pour l&apos;instant</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Modèle</th><th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3 text-right">Envois</th><th className="px-4 py-3 text-center">Actif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {modeles.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{m.nom}</p>
                    <p className="text-xs text-slate-400">par {m.creePar.prenom} {m.creePar.nom}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{CATEGORIE_LABEL[m.categorie] ?? m.categorie}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{m._count.envois}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${m.actif ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modalOpen && <ModeleMessageForm onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); refetch(); }} />}
    </div>
  );
}

function Journal({ codeCanal }: { codeCanal: string }) {
  const [statutFiltre, setStatutFiltre] = useState("");
  const { data: canauxRes } = useApi<{ data: CanalMarketing[] }>("/api/admin/marketing/canaux");
  const canalId = (canauxRes?.data ?? []).find((c) => c.code === codeCanal)?.id;
  const { data: res, loading } = useApi<{ data: EnvoiItem[] }>(
    canalId ? `/api/admin/marketing/envois?canalId=${canalId}${statutFiltre ? `&statut=${statutFiltre}` : ""}` : null
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <select value={statutFiltre} onChange={(e) => setStatutFiltre(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
          <option value="">Tous les statuts</option>
          {Object.keys(STATUT_STYLE).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading && !res ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (res?.data ?? []).length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucun envoi pour l&apos;instant</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Client</th><th className="px-4 py-3">Campagne</th>
                <th className="px-4 py-3">Date</th>
                {codeCanal === "SMS" && <th className="px-4 py-3 text-right">Coût</th>}
                <th className="px-4 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {res!.data.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{e.client.prenom} {e.client.nom}</p>
                    <p className="text-xs text-slate-400">{e.destinataire}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.campagne?.nom ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(e.dateEnvoi)}</td>
                  {codeCanal === "SMS" && <td className="px-4 py-3 text-right text-slate-600">{e.coutEstime ? `${e.coutEstime} FCFA` : "—"}</td>}
                  <td className="px-4 py-3 text-center">
                    <span title={e.erreur ?? undefined} className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUT_STYLE[e.statut]}`}>{e.statut}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function NotificationsTab() {
  const { data: res, loading, refetch } = useApi<{ data: NotificationItem[] }>("/api/notifications?limit=30");
  const idRef = useRef<number | null>(null);
  const { mutate: marquerLue } = useMutation<unknown, Record<string, never>>(
    () => `/api/notifications/${idRef.current}/read`, "PATCH"
  );

  if (loading && !res) return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const notifications = res?.data ?? [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
      {notifications.length === 0 ? (
        <p className="text-center text-slate-400 py-16">Aucune notification</p>
      ) : notifications.map((n) => (
        <button key={n.id} onClick={async () => { if (!n.lue) { idRef.current = n.id; await marquerLue({}); refetch(); } }}
          className={`w-full text-left px-4 py-3 hover:bg-slate-50/60 flex items-start gap-3 ${n.lue ? "" : "bg-fuchsia-50/40"}`}>
          <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.lue ? "bg-slate-200" : "bg-fuchsia-500"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">{n.titre}</p>
            <p className="text-xs text-slate-500">{n.message}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(n.createdAt)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function Parametres() {
  const { data: res, loading, refetch } = useApi<{ data: { maxCommunicationsParSemaine: number; coutParSms: string } }>("/api/admin/marketing/parametrage");
  const [valeur, setValeur] = useState("");
  const [coutSms, setCoutSms] = useState("");
  const { mutate: enregistrer, loading: saving } = useMutation<unknown, { maxCommunicationsParSemaine?: number; coutParSms?: number }>(
    "/api/admin/marketing/parametrage", "PATCH", { successMessage: "Réglage enregistré", invalidate: "/api/admin/marketing/parametrage" }
  );

  if (loading && !res) return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const actuel = res?.data.maxCommunicationsParSemaine ?? 3;
  const actuelCout = res?.data.coutParSms ?? "20";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-1">Frequency capping</h3>
        <p className="text-xs text-slate-400 mb-4">Nombre maximum de communications marketing envoyées à un même client sur 7 jours glissants.</p>
        <div className="flex items-center gap-2">
          <input type="number" min={1} placeholder={String(actuel)} value={valeur} onChange={(e) => setValeur(e.target.value)}
            className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          <span className="text-sm text-slate-500">/ semaine / client</span>
        </div>
        <button
          onClick={async () => { const v = Number(valeur); if (v > 0 && (await enregistrer({ maxCommunicationsParSemaine: v }))) { setValeur(""); refetch(); } }}
          disabled={saving || !valeur}
          className="mt-4 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 disabled:opacity-50">
          Enregistrer
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-1">Coût SMS</h3>
        <p className="text-xs text-slate-400 mb-4">Coût forfaitaire estimé par SMS envoyé, utilisé pour le suivi budgétaire.</p>
        <div className="flex items-center gap-2">
          <input type="number" min={0} placeholder={actuelCout} value={coutSms} onChange={(e) => setCoutSms(e.target.value)}
            className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          <span className="text-sm text-slate-500">FCFA / SMS</span>
        </div>
        <button
          onClick={async () => { const v = Number(coutSms); if (v >= 0 && (await enregistrer({ coutParSms: v }))) { setCoutSms(""); refetch(); } }}
          disabled={saving || !coutSms}
          className="mt-4 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 disabled:opacity-50">
          Enregistrer
        </button>
      </div>
    </div>
  );
}
