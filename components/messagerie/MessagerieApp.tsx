"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, Search, X, Send, MessageSquarePlus, Loader2, MessageSquare } from "lucide-react";
import { formatDate } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Personne {
  id: number; nom: string; prenom: string; email: string; photo: string | null;
  role: string | null; gestionnaireRole: string | null;
}
interface ConversationRow {
  id: number;
  autreParticipant: Personne;
  dernierMessage: { contenu: string; createdAt: string; expediteurId: number } | null;
  dernierMessageAt: string;
  nonLus: number;
}
interface MessageRow {
  id: number; conversationId: number; expediteurId: number; contenu: string;
  lu: boolean; dateLecture: string | null; createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", ADMIN: "Admin", USER: "Membre",
  RESPONSABLE_POINT_DE_VENTE: "Resp. point de vente", CHEF_AGENCE: "Chef d'agence",
  RESPONSABLE_COMMUNAUTE: "Resp. communauté", AGENT_LOGISTIQUE_APPROVISIONNEMENT: "Agent logistique",
  MAGAZINIER: "Magasinier", CAISSIER: "Caissier", COMMERCIAL: "Commercial",
  DIRECTEUR_COMMERCIAL: "Directeur commercial", COMPTABLE: "Comptable",
  AUDITEUR_INTERNE: "Auditeur interne", RESPONSABLE_VENTE_CREDIT: "Resp. vente crédit",
  CONTROLEUR_TERRAIN: "Contrôleur terrain", AGENT_TERRAIN: "Agent terrain",
  RESPONSABLE_ECONOMIQUE: "Resp. économique", RESPONSABLE_MARKETING: "Resp. marketing",
  ACTIONNAIRE: "Actionnaire", REVENDEUR: "Revendeur", RESPONSABLE_RH: "Resp. RH",
  INVESTISSEUR_RIA: "Investisseur RIA", RESPONSABLE_RIA: "Resp. RIA",
  PRESIDENT_COMMISSION_RIA: "Président commission", RAPPORTEUR_COMMISSION_RIA: "Rapporteur commission",
};

function roleLabel(p: Pick<Personne, "role" | "gestionnaireRole">): string {
  if (p.gestionnaireRole) return ROLE_LABELS[p.gestionnaireRole] ?? p.gestionnaireRole;
  if (p.role) return ROLE_LABELS[p.role] ?? p.role;
  return "";
}
function initiales(nom: string, prenom: string) {
  return `${prenom?.[0] ?? ""}${nom?.[0] ?? ""}`.toUpperCase();
}
function Avatar({ p, size = 44 }: { p: Personne; size?: number }) {
  if (p.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.photo} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-semibold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initiales(p.nom, p.prenom)}
    </div>
  );
}

export default function MessagerieApp({ initialConversationId }: { initialConversationId?: number }) {
  const { data: session } = useSession();
  const meId = session?.user?.id ? Number(session.user.id) : null;

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(initialConversationId ?? null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [texte, setTexte] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contacts, setContacts] = useState<Personne[]>([]);
  const [mobileShowThread, setMobileShowThread] = useState(!!initialConversationId);
  const [contactCible, setContactCible] = useState<Personne | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async (silencieux = false) => {
    if (!silencieux) setLoadingList(true);
    try {
      const r = await fetch("/api/messages/conversations");
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setConversations(j.data ?? []);
    } catch (e) { if (!silencieux) toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { if (!silencieux) setLoadingList(false); }
  }, []);

  const loadMessages = useCallback(async (conversationId: number, silencieux = false) => {
    if (!silencieux) setLoadingThread(true);
    try {
      const r = await fetch(`/api/messages/conversations/${conversationId}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setMessages(j.data ?? []);
    } catch (e) { if (!silencieux) toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { if (!silencieux) setLoadingThread(false); }
  }, []);

  // Liste des conversations : chargement + rafraîchissement périodique
  useEffect(() => {
    loadConversations();
    const id = setInterval(() => loadConversations(true), 15_000);
    return () => clearInterval(id);
  }, [loadConversations]);

  // Fil actif : chargement + rafraîchissement périodique + marquage lu
  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);
    const id = setInterval(() => loadMessages(activeId, true), 5_000);
    return () => clearInterval(id);
  }, [activeId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeId]);

  // Recherche de contacts pour démarrer une nouvelle conversation
  useEffect(() => {
    if (!showNewChat) return;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/messages/utilisateurs?search=${encodeURIComponent(contactSearch)}`);
        const j = await r.json();
        if (r.ok) setContacts(j.data ?? []);
      } catch { /* silencieux */ }
    }, 250);
    return () => clearTimeout(timer);
  }, [showNewChat, contactSearch]);

  const ouvrirConversation = (id: number) => {
    setActiveId(id);
    setMobileShowThread(true);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, nonLus: 0 } : c)));
  };

  const demarrerAvecContact = async (contact: Personne) => {
    const existante = conversations.find((c) => c.autreParticipant.id === contact.id);
    setShowNewChat(false);
    setContactSearch("");
    if (existante) { ouvrirConversation(existante.id); return; }
    // Pas encore de conversation : on l'ouvre "à vide", le premier message la créera.
    setActiveId(-contact.id); // id négatif = conversation virtuelle pas encore créée, on garde le contact ciblé
    setMessages([]);
    setMobileShowThread(true);
    setContactCible(contact);
  };

  const envoyer = async () => {
    const contenu = texte.trim();
    if (!contenu || sending || !activeId) return;
    setSending(true);
    try {
      if (activeId < 0 && contactCible) {
        const r = await fetch("/api/messages/conversations", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ destinataireId: contactCible.id, contenu }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.message ?? "Erreur");
        setActiveId(j.data.conversationId);
        setContactCible(null);
        setTexte("");
        await loadConversations(true);
        await loadMessages(j.data.conversationId, true);
      } else {
        const r = await fetch(`/api/messages/conversations/${activeId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contenu }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.message ?? "Erreur");
        setTexte("");
        await loadMessages(activeId, true);
        await loadConversations(true);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSending(false); }
  };

  const conversationActive = conversations.find((c) => c.id === activeId);
  const autreActuel = conversationActive?.autreParticipant ?? contactCible;

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[500px] bg-white rounded-2xl border border-gray-200 overflow-hidden flex">
      {/* ── Liste des conversations ─────────────────────────────────────── */}
      <div className={`w-full md:w-80 shrink-0 border-r border-gray-100 flex flex-col ${mobileShowThread ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Messages</h2>
          <button onClick={() => setShowNewChat(true)} title="Nouvelle conversation"
            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
            <MessageSquarePlus className="w-5 h-5" />
          </button>
        </div>

        {showNewChat ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input autoFocus value={contactSearch} onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Rechercher une personne…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <button onClick={() => { setShowNewChat(false); setContactSearch(""); }} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {contacts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aucun résultat</p>
              ) : contacts.map((c) => (
                <button key={c.id} onClick={() => demarrerAvecContact(c)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50">
                  <Avatar p={c} size={38} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.prenom} {c.nom}</p>
                    <p className="text-xs text-gray-400 truncate">{roleLabel(c)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-gray-400 px-6 text-center">
                <MessageSquare className="w-8 h-8 opacity-40" />
                <p className="text-sm">Aucune conversation. Cliquez sur + pour écrire à quelqu&apos;un.</p>
              </div>
            ) : conversations.map((c) => (
              <button key={c.id} onClick={() => ouvrirConversation(c.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 ${activeId === c.id ? "bg-emerald-50/60" : ""}`}>
                <Avatar p={c.autreParticipant} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800 truncate">{c.autreParticipant.prenom} {c.autreParticipant.nom}</p>
                    <span className="text-[10px] text-gray-400 shrink-0">{formatDate(c.dernierMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500 truncate">
                      {c.dernierMessage ? (c.dernierMessage.expediteurId === meId ? "Vous : " : "") + c.dernierMessage.contenu : roleLabel(c.autreParticipant)}
                    </p>
                    {c.nonLus > 0 && (
                      <span className="text-[10px] bg-emerald-500 text-white font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shrink-0">
                        {c.nonLus > 99 ? "99+" : c.nonLus}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Fil de discussion ───────────────────────────────────────────── */}
      <div className={`flex-1 flex-col min-w-0 ${mobileShowThread ? "flex" : "hidden md:flex"}`}>
        {!activeId || !autreActuel ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-2">
            <MessageSquare className="w-10 h-10 opacity-30" />
            <p className="text-sm">Sélectionnez une conversation</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
              <button onClick={() => setMobileShowThread(false)} className="md:hidden p-1 text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Avatar p={autreActuel} size={38} />
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{autreActuel.prenom} {autreActuel.nom}</p>
                <p className="text-xs text-gray-400 truncate">{roleLabel(autreActuel)}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/50">
              {loadingThread ? (
                <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">Aucun message. Dites bonjour 👋</p>
              ) : messages.map((m) => {
                const mine = m.expediteurId === meId;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${mine ? "bg-emerald-600 text-white rounded-br-sm" : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"}`}>
                      {m.contenu}
                      <div className={`text-[10px] mt-1 ${mine ? "text-emerald-100" : "text-gray-400"}`}>{formatDate(m.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-gray-100 flex items-center gap-2">
              <input
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
                placeholder="Écrivez un message…"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button onClick={envoyer} disabled={sending || !texte.trim()}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-full transition-colors shrink-0">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
