"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef, Fragment } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { generateUploadButton } from "@uploadthing/react";
import {
  ArrowLeft, Search, X, Send, MessageSquarePlus, Loader2, MessageSquare,
  Smile, Paperclip, FileText, Download, Pencil, Trash2, Check, ArrowDown,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

const UploadButton = generateUploadButton<OurFileRouter>();

// ─── Types ────────────────────────────────────────────────────────────────────

interface Personne {
  id: number; nom: string; prenom: string; email: string; photo: string | null;
  role: string | null; gestionnaireRole: string | null;
}
interface PieceJointe { url: string; nom: string; type: string; taille: number }
interface ConversationRow {
  id: number;
  autreParticipant: Personne;
  dernierMessage: { contenu: string; createdAt: string; expediteurId: number; pieceJointeNom: string | null; supprime: boolean } | null;
  dernierMessageAt: string;
  nonLus: number;
}
interface MessageRow {
  id: number; conversationId: number; expediteurId: number; contenu: string;
  lu: boolean; dateLecture: string | null; createdAt: string;
  pieceJointeUrl: string | null; pieceJointeNom: string | null; pieceJointeType: string | null; pieceJointeTaille: number | null;
  modifie: boolean; supprime: boolean;
}

interface ResultatRecherche {
  id: number; conversationId: number; expediteurId: number; contenu: string; createdAt: string;
  autreParticipant: Personne;
}
interface PageMessages { data: MessageRow[]; hasOlder: boolean; hasNewer: boolean }

// ─── Dates (séparateurs de jour, heure des bulles, liste des conversations) ───

function memeJour(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function hier(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}
/** Séparateur du fil : « Aujourd'hui », « Hier », sinon « Lundi 22 septembre » (+ année si autre année). */
function libelleJour(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (memeJour(d, now)) return "Aujourd'hui";
  if (memeJour(d, hier())) return "Hier";
  const s = d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
/** Date compacte de la liste : heure aujourd'hui, « Hier », jour de la semaine, sinon jj/mm/aa. */
function dateCompacte(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (memeJour(d, now)) return heure(iso);
  if (memeJour(d, hier())) return "Hier";
  if (now.getTime() - d.getTime() < 6 * 24 * 3600 * 1000) {
    const j = d.toLocaleDateString("fr-FR", { weekday: "long" });
    return j.charAt(0).toUpperCase() + j.slice(1);
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// ─── Recherche ────────────────────────────────────────────────────────────────

/** Minuscules sans accents, pour comparer « Hélène » et « helene ». */
function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
/** Extrait centré sur la première occurrence, occurrence(s) surlignée(s). */
function ExtraitSurligne({ texte, q }: { texte: string; q: string }) {
  const idx = normaliser(texte).indexOf(normaliser(q));
  const debut = idx > 30 ? idx - 30 : 0;
  const extrait = (debut > 0 ? "…" : "") + texte.slice(debut, debut + 120);
  if (!q) return <>{extrait}</>;
  const echappe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const morceaux = extrait.split(new RegExp(`(${echappe})`, "gi"));
  return (
    <>
      {morceaux.map((m, i) =>
        i % 2 === 1 ? <mark key={i} className="bg-amber-200 text-slate-900 rounded px-0.5">{m}</mark> : <Fragment key={i}>{m}</Fragment>,
      )}
    </>
  );
}

const EMOJIS = ["👋","😊","✅","❌","⚠️","📦","💰","📝","🔔","👍","👎","🎉","📊","🤝","💬","📞","✉️","🕐","🔍","📋","💡","🚀","✨","🙏","😅","🤔","👏","🎯","📈","📉"];

function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button type="button" onClick={() => setOpen((o) => !o)} title="Emojis"
        className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-full transition-colors">
        <Smile className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-20 w-64 flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => { onPick(e); setOpen(false); }}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 rounded-lg transition-colors">
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

function PieceJointeBulle({ url, nom, type, taille }: { url: string; nom: string | null; type: string | null; taille: number | null }) {
  if (type?.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={nom ?? ""} className="max-w-full max-h-60 rounded-lg mb-1" /></a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" download
      className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors mb-1">
      <FileText className="w-5 h-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{nom ?? "Fichier"}</p>
        {taille != null && <p className="text-[10px] opacity-70">{formatTaille(taille)}</p>}
      </div>
      <Download className="w-3.5 h-3.5 shrink-0 opacity-70" />
    </a>
  );
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
      className="rounded-full bg-gradient-to-br from-primary-500 to-teal-600 text-white font-semibold flex items-center justify-center shrink-0"
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
  const [pieceJointeEnAttente, setPieceJointeEnAttente] = useState<PieceJointe | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTexte, setEditTexte] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Pagination du fil : hasOlder = historique plus ancien à charger en remontant ;
  // hasNewer = on a sauté dans l'historique (résultat de recherche), des messages plus
  // récents restent à charger en redescendant. Doublés en refs pour les callbacks/intervalles.
  const [hasOlder, setHasOlder] = useState(false);
  const [hasNewer, setHasNewer] = useState(false);
  const hasOlderRef = useRef(false);
  const hasNewerRef = useRef(false);
  const [chargementPage, setChargementPage] = useState(false);
  const chargementPageRef = useRef(false);
  const [auFond, setAuFond] = useState(true);
  const [nouveauxEnAttente, setNouveauxEnAttente] = useState(false);
  const [surligneId, setSurligneId] = useState<number | null>(null);

  // Défilement : le fil ne redescend tout seul que si l'utilisateur est déjà en bas
  // (ou vient d'envoyer un message) — sinon on ne touche pas à sa position de lecture.
  const threadRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<number | null>(activeId);
  const presDuFondRef = useRef(true);
  const allerAuFondRef = useRef(false);          // prochain rendu : sauter tout en bas
  const distanceFondAvantRef = useRef<number | null>(null); // prochain rendu : garder la position (ajout en haut)
  const focusMessageRef = useRef<number | null>(null);      // prochain rendu : centrer ce message
  const focusEnAttenteRef = useRef<number | null>(null);    // conversation à ouvrir directement sur ce message
  const dernierIdRef = useRef(0);

  // Recherche (conversations par nom + messages par contenu)
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<ResultatRecherche[]>([]);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);

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

  const majPagination = useCallback((older: boolean | null, newer: boolean | null) => {
    if (older !== null) { hasOlderRef.current = older; setHasOlder(older); }
    if (newer !== null) { hasNewerRef.current = newer; setHasNewer(newer); }
  }, []);

  const fetchPage = useCallback(async (conversationId: number, qs = ""): Promise<PageMessages> => {
    const r = await fetch(`/api/messages/conversations/${conversationId}${qs}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.message ?? "Erreur");
    return { data: j.data ?? [], hasOlder: !!j.hasOlder, hasNewer: !!j.hasNewer };
  }, []);

  /** Ouvre le fil sur ses derniers messages, défilé tout en bas. */
  const chargerDerniers = useCallback(async (conversationId: number, silencieux = false) => {
    if (!silencieux) setLoadingThread(true);
    try {
      const page = await fetchPage(conversationId);
      if (activeIdRef.current !== conversationId) return;
      allerAuFondRef.current = true;
      setNouveauxEnAttente(false);
      setMessages(page.data);
      majPagination(page.hasOlder, false);
    } catch (e) { if (!silencieux) toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { if (!silencieux) setLoadingThread(false); }
  }, [fetchPage, majPagination]);

  /** Ouvre le fil centré sur un message (résultat de recherche), avec son contexte. */
  const chargerAutour = useCallback(async (conversationId: number, messageId: number) => {
    setLoadingThread(true);
    try {
      const page = await fetchPage(conversationId, `?around=${messageId}`);
      if (activeIdRef.current !== conversationId) return;
      focusMessageRef.current = messageId;
      setSurligneId(messageId);
      setTimeout(() => setSurligneId((id) => (id === messageId ? null : id)), 3000);
      setMessages(page.data);
      majPagination(page.hasOlder, page.hasNewer);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoadingThread(false); }
  }, [fetchPage, majPagination]);

  /** Rafraîchissement périodique : fusionne les derniers messages (nouveaux + modifiés/supprimés)
   *  sans remplacer l'historique déjà chargé ni bouger la position de lecture. */
  const rafraichir = useCallback(async (conversationId: number) => {
    if (hasNewerRef.current) return; // dans l'historique : les derniers seront chargés en redescendant
    try {
      const page = await fetchPage(conversationId);
      if (activeIdRef.current !== conversationId || hasNewerRef.current) return;
      setMessages((prev) => {
        const recus = new Map(page.data.map((m) => [m.id, m]));
        const majs = prev.map((m) => recus.get(m.id) ?? m);
        const dernierId = prev.length ? prev[prev.length - 1].id : 0;
        const nouveaux = page.data.filter((m) => m.id > dernierId);
        return nouveaux.length ? [...majs, ...nouveaux] : majs;
      });
    } catch { /* silencieux */ }
  }, [fetchPage]);

  /** Remontée dans l'historique : page précédente ajoutée en haut, position conservée. */
  const chargerPlusAnciens = useCallback(async () => {
    const conversationId = activeIdRef.current;
    const premier = messages[0];
    if (!conversationId || conversationId < 0 || !premier || chargementPageRef.current || !hasOlderRef.current) return;
    chargementPageRef.current = true;
    setChargementPage(true);
    try {
      const page = await fetchPage(conversationId, `?before=${premier.id}`);
      if (activeIdRef.current !== conversationId) return;
      const el = threadRef.current;
      if (el) distanceFondAvantRef.current = el.scrollHeight - el.scrollTop;
      setMessages((prev) => [...page.data.filter((m) => m.id < (prev[0]?.id ?? Infinity)), ...prev]);
      majPagination(page.hasOlder, null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { chargementPageRef.current = false; setChargementPage(false); }
  }, [messages, fetchPage, majPagination]);

  /** Redescente après un saut dans l'historique : page suivante ajoutée en bas. */
  const chargerPlusRecents = useCallback(async () => {
    const conversationId = activeIdRef.current;
    const dernier = messages[messages.length - 1];
    if (!conversationId || conversationId < 0 || !dernier || chargementPageRef.current || !hasNewerRef.current) return;
    chargementPageRef.current = true;
    setChargementPage(true);
    try {
      const page = await fetchPage(conversationId, `?after=${dernier.id}`);
      if (activeIdRef.current !== conversationId) return;
      dernierIdRef.current = page.data.length ? page.data[page.data.length - 1].id : dernierIdRef.current; // pas d'auto-défilement
      setMessages((prev) => [...prev, ...page.data.filter((m) => m.id > (prev[prev.length - 1]?.id ?? 0))]);
      majPagination(null, page.hasNewer);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { chargementPageRef.current = false; setChargementPage(false); }
  }, [messages, fetchPage, majPagination]);

  const onScrollFil = () => {
    const el = threadRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    presDuFondRef.current = distance < 80;
    setAuFond(distance < 200);
    if (presDuFondRef.current) setNouveauxEnAttente(false);
    if (el.scrollTop < 80) chargerPlusAnciens();
    if (distance < 80) chargerPlusRecents();
  };

  const revenirAuxDerniers = () => {
    if (!activeId || activeId < 0) return;
    if (hasNewerRef.current) { chargerDerniers(activeId); return; }
    const el = threadRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setNouveauxEnAttente(false);
  };

  // Liste des conversations : chargement + rafraîchissement périodique
  useEffect(() => {
    loadConversations();
    const id = setInterval(() => loadConversations(true), 15_000);
    return () => clearInterval(id);
  }, [loadConversations]);

  // Fil actif : chargement (derniers messages, ou directement sur un résultat de recherche)
  // + rafraîchissement périodique + marquage lu
  useEffect(() => {
    activeIdRef.current = activeId;
    setEditingId(null);
    setEditTexte("");
    setNouveauxEnAttente(false);
    dernierIdRef.current = 0;
    presDuFondRef.current = true;
    if (!activeId) return;
    if (activeId < 0) { setMessages([]); majPagination(false, false); return; } // conversation virtuelle (nouveau contact) : pas encore créée côté serveur
    const focus = focusEnAttenteRef.current;
    focusEnAttenteRef.current = null;
    if (focus) chargerAutour(activeId, focus);
    else chargerDerniers(activeId);
    const id = setInterval(() => rafraichir(activeId), 5_000);
    return () => clearInterval(id);
  }, [activeId, chargerDerniers, chargerAutour, rafraichir, majPagination]);

  // Position de défilement après chaque mise à jour du fil (avant affichage, pas de saut visible)
  useLayoutEffect(() => {
    const el = threadRef.current;
    const dernier = messages[messages.length - 1];
    const dernierId = dernier?.id ?? 0;
    if (!el) { dernierIdRef.current = dernierId; return; }
    if (distanceFondAvantRef.current !== null) {
      // Messages plus anciens ajoutés en haut : on garde le même message sous les yeux
      el.scrollTop = el.scrollHeight - distanceFondAvantRef.current;
      distanceFondAvantRef.current = null;
    } else if (focusMessageRef.current !== null) {
      el.querySelector(`[data-mid="${focusMessageRef.current}"]`)?.scrollIntoView({ block: "center" });
      focusMessageRef.current = null;
    } else if (allerAuFondRef.current) {
      el.scrollTop = el.scrollHeight;
      allerAuFondRef.current = false;
      presDuFondRef.current = true;
      setAuFond(true);
    } else if (dernier && dernierId > dernierIdRef.current && dernierIdRef.current !== 0) {
      // Nouveau message : on suit si l'utilisateur était en bas ou si c'est le sien
      if (presDuFondRef.current || dernier.expediteurId === meId) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      else setNouveauxEnAttente(true);
    }
    dernierIdRef.current = dernierId;
  }, [messages, meId]);

  // Recherche de messages (le filtrage des conversations par nom est fait localement)
  useEffect(() => {
    const q = recherche.trim();
    if (q.length < 2) { setResultats([]); setRechercheEnCours(false); return; }
    setRechercheEnCours(true);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/messages/recherche?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        if (r.ok) setResultats(j.data ?? []);
      } catch { /* silencieux */ }
      finally { setRechercheEnCours(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [recherche]);

  const ouvrirResultat = (res: ResultatRecherche) => {
    setMobileShowThread(true);
    setConversations((prev) => prev.map((c) => (c.id === res.conversationId ? { ...c, nonLus: 0 } : c)));
    if (activeId === res.conversationId) { chargerAutour(res.conversationId, res.id); return; }
    focusEnAttenteRef.current = res.id;
    setActiveId(res.conversationId);
  };

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
    if ((!contenu && !pieceJointeEnAttente) || sending || uploading || !activeId) return;
    setSending(true);
    try {
      if (activeId < 0 && contactCible) {
        const r = await fetch("/api/messages/conversations", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ destinataireId: contactCible.id, contenu, pieceJointe: pieceJointeEnAttente ?? undefined }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.message ?? "Erreur");
        setActiveId(j.data.conversationId); // l'effet du fil actif charge ses messages
        setContactCible(null);
        setTexte("");
        setPieceJointeEnAttente(null);
        await loadConversations(true);
      } else {
        const r = await fetch(`/api/messages/conversations/${activeId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contenu, pieceJointe: pieceJointeEnAttente ?? undefined }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.message ?? "Erreur");
        setTexte("");
        setPieceJointeEnAttente(null);
        // Envoi depuis l'historique : retour aux derniers messages ; sinon simple fusion
        // (le nouveau message étant le nôtre, le fil descend dessus).
        if (hasNewerRef.current) await chargerDerniers(activeId, true);
        else await rafraichir(activeId);
        await loadConversations(true);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSending(false); }
  };

  const commencerEdition = (m: MessageRow) => {
    setEditingId(m.id);
    setEditTexte(m.contenu);
  };

  const annulerEdition = () => {
    setEditingId(null);
    setEditTexte("");
  };

  const enregistrerEdition = async () => {
    if (!editingId || !activeId || savingEdit) return;
    const contenu = editTexte.trim();
    if (!contenu) return;
    setSavingEdit(true);
    try {
      const r = await fetch(`/api/messages/conversations/${activeId}/messages/${editingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenu }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setMessages((prev) => prev.map((m) => (m.id === editingId ? j.data : m)));
      annulerEdition();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSavingEdit(false); }
  };

  const supprimerMessage = async (messageId: number) => {
    if (!activeId || deletingId !== null) return;
    if (!window.confirm("Supprimer ce message ? Il sera remplacé par « Message supprimé » dans le fil.")) return;
    setDeletingId(messageId);
    try {
      const r = await fetch(`/api/messages/conversations/${activeId}/messages/${messageId}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setMessages((prev) => prev.map((m) => (m.id === messageId ? j.data : m)));
      if (editingId === messageId) annulerEdition();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setDeletingId(null); }
  };

  const rechercheTexte = recherche.trim();
  const rechercheActive = rechercheTexte.length > 0;
  const conversationsFiltrees = rechercheActive
    ? conversations.filter((c) => normaliser(`${c.autreParticipant.prenom} ${c.autreParticipant.nom}`).includes(normaliser(rechercheTexte)))
    : conversations;

  const ligneConversation = (c: ConversationRow) => (
    <button key={c.id} onClick={() => ouvrirConversation(c.id)}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 ${activeId === c.id ? "bg-primary-50/60" : ""}`}>
      <Avatar p={c.autreParticipant} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800 truncate">{c.autreParticipant.prenom} {c.autreParticipant.nom}</p>
          <span className="text-[10px] text-slate-400 shrink-0" title={formatDateTime(c.dernierMessageAt)}>{dateCompacte(c.dernierMessageAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500 truncate">
            {c.dernierMessage
              ? (c.dernierMessage.expediteurId === meId ? "Vous : " : "") +
                (c.dernierMessage.supprime ? "Message supprimé" : (c.dernierMessage.contenu || (c.dernierMessage.pieceJointeNom ? `📎 ${c.dernierMessage.pieceJointeNom}` : "")))
              : roleLabel(c.autreParticipant)}
          </p>
          {c.nonLus > 0 && (
            <span className="text-[10px] bg-primary-500 text-white font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shrink-0">
              {c.nonLus > 99 ? "99+" : c.nonLus}
            </span>
          )}
        </div>
      </div>
    </button>
  );

  const conversationActive = conversations.find((c) => c.id === activeId);
  const autreActuel = conversationActive?.autreParticipant ?? contactCible;

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[500px] bg-white rounded-2xl border border-slate-200 overflow-hidden flex">
      {/* ── Liste des conversations ─────────────────────────────────────── */}
      <div className={`w-full md:w-80 shrink-0 border-r border-slate-100 flex flex-col ${mobileShowThread ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">Messages</h2>
          <button onClick={() => setShowNewChat(true)} title="Nouvelle conversation"
            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
            <MessageSquarePlus className="w-5 h-5" />
          </button>
        </div>

        {showNewChat ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input autoFocus value={contactSearch} onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Rechercher une personne…"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <button onClick={() => { setShowNewChat(false); setContactSearch(""); }} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {contacts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Aucun résultat</p>
              ) : contacts.map((c) => (
                <button key={c.id} onClick={() => demarrerAvecContact(c)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50">
                  <Avatar p={c} size={38} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.prenom} {c.nom}</p>
                    <p className="text-xs text-slate-400 truncate">{roleLabel(c)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Recherche : conversations par nom + messages par contenu */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher une conversation ou un message…"
                  className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                {recherche && (
                  <button onClick={() => setRecherche("")} title="Effacer"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : rechercheActive ? (
              <>
                {conversationsFiltrees.length > 0 && (
                  <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Conversations</p>
                )}
                {conversationsFiltrees.map((c) => ligneConversation(c))}
                <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-2">
                  Messages {rechercheEnCours && <Loader2 className="w-3 h-3 animate-spin" />}
                </p>
                {rechercheTexte.length < 2 ? (
                  <p className="px-4 py-2 text-xs text-slate-400">Tapez au moins 2 caractères pour chercher dans les messages.</p>
                ) : !rechercheEnCours && resultats.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-slate-400">Aucun message trouvé.</p>
                ) : resultats.map((res) => (
                  <button key={res.id} onClick={() => ouvrirResultat(res)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50">
                    <Avatar p={res.autreParticipant} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{res.autreParticipant.prenom} {res.autreParticipant.nom}</p>
                        <span className="text-[10px] text-slate-400 shrink-0" title={formatDateTime(res.createdAt)}>{dateCompacte(res.createdAt)}</span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 break-words">
                        {res.expediteurId === meId ? "Vous : " : ""}<ExtraitSurligne texte={res.contenu} q={rechercheTexte} />
                      </p>
                    </div>
                  </button>
                ))}
              </>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-slate-400 px-6 text-center">
                <MessageSquare className="w-8 h-8 opacity-40" />
                <p className="text-sm">Aucune conversation. Cliquez sur + pour écrire à quelqu&apos;un.</p>
              </div>
            ) : conversations.map((c) => ligneConversation(c))}
          </div>
          </div>
        )}
      </div>

      {/* ── Fil de discussion ───────────────────────────────────────────── */}
      <div className={`flex-1 flex-col min-w-0 ${mobileShowThread ? "flex" : "hidden md:flex"}`}>
        {!activeId || !autreActuel ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-2">
            <MessageSquare className="w-10 h-10 opacity-30" />
            <p className="text-sm">Sélectionnez une conversation</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <button onClick={() => setMobileShowThread(false)} className="md:hidden p-1 text-slate-400 hover:text-slate-600">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Avatar p={autreActuel} size={38} />
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">{autreActuel.prenom} {autreActuel.nom}</p>
                <p className="text-xs text-slate-400 truncate">{roleLabel(autreActuel)}</p>
              </div>
            </div>

            <div className="relative flex-1 min-h-0 flex flex-col">
            <div ref={threadRef} onScroll={onScrollFil} className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
              {!loadingThread && hasOlder && (
                <div className="flex justify-center py-1">
                  <button onClick={chargerPlusAnciens} disabled={chargementPage}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs text-slate-500 bg-white border border-slate-200 rounded-full hover:bg-slate-100 disabled:opacity-60">
                    {chargementPage && <Loader2 className="w-3 h-3 animate-spin" />} Messages précédents
                  </button>
                </div>
              )}
              {loadingThread ? (
                <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-10">Aucun message. Dites bonjour 👋</p>
              ) : messages.map((m, i) => {
                const mine = m.expediteurId === meId;
                const editionEnCours = editingId === m.id;
                const nouveauJour = i === 0 || !memeJour(new Date(messages[i - 1].createdAt), new Date(m.createdAt));
                return (
                  <Fragment key={m.id}>
                  {nouveauJour && (
                    <div className="flex justify-center pt-2 pb-1">
                      <span className="px-3 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-full shadow-sm">
                        {libelleJour(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <div data-mid={m.id} className={`group flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
                    {mine && !m.supprime && !editionEnCours && (
                      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 mb-0.5">
                        <button onClick={() => commencerEdition(m)} title="Modifier"
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => supprimerMessage(m.id)} disabled={deletingId === m.id} title="Supprimer"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-40">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className={`max-w-[70%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words transition-shadow ${
                      surligneId === m.id ? "ring-4 ring-amber-300" : ""
                    } ${
                      m.supprime ? "bg-slate-100 border border-slate-200 text-slate-400 italic rounded-bl-sm"
                        : mine ? "bg-primary-600 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
                    }`}>
                      {m.supprime ? (
                        <span>Message supprimé</span>
                      ) : editionEnCours ? (
                        <div className="flex items-end gap-1.5 min-w-[180px]">
                          <input
                            autoFocus
                            value={editTexte}
                            onChange={(e) => setEditTexte(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); enregistrerEdition(); }
                              if (e.key === "Escape") { e.preventDefault(); annulerEdition(); }
                            }}
                            className="flex-1 bg-white/10 border border-white/30 rounded-lg px-2 py-1 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-1 focus:ring-white/60"
                          />
                          <button onClick={enregistrerEdition} disabled={savingEdit || !editTexte.trim()} title="Enregistrer"
                            className="p-1.5 text-white hover:bg-white/20 rounded-full transition-colors disabled:opacity-40">
                            {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={annulerEdition} title="Annuler"
                            className="p-1.5 text-white hover:bg-white/20 rounded-full transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          {m.pieceJointeUrl && (
                            <PieceJointeBulle url={m.pieceJointeUrl} nom={m.pieceJointeNom} type={m.pieceJointeType} taille={m.pieceJointeTaille} />
                          )}
                          {m.contenu}
                        </>
                      )}
                      {!editionEnCours && (
                        <div title={formatDateTime(m.createdAt)}
                          className={`text-[10px] mt-1 text-right ${m.supprime ? "text-slate-400" : mine ? "text-primary-100" : "text-slate-400"}`}>
                          {heure(m.createdAt)}{m.modifie && !m.supprime ? " · modifié" : ""}
                        </div>
                      )}
                    </div>
                  </div>
                  </Fragment>
                );
              })}
              {!loadingThread && hasNewer && (
                <div className="flex justify-center py-1">
                  <Loader2 className={`w-4 h-4 text-slate-400 ${chargementPage ? "animate-spin" : "opacity-0"}`} />
                </div>
              )}
            </div>
            {/* Retour aux derniers messages (après avoir remonté l'historique ou sauté sur un résultat) */}
            {!loadingThread && (hasNewer || !auFond) && (
              <button onClick={revenirAuxDerniers} title="Derniers messages"
                className="absolute bottom-3 right-4 flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-full shadow-lg text-xs font-medium text-slate-600 hover:bg-slate-50">
                {nouveauxEnAttente && <span className="w-2 h-2 rounded-full bg-primary-500" />}
                {nouveauxEnAttente ? "Nouveaux messages" : ""}
                <ArrowDown className="w-4 h-4" />
              </button>
            )}
            </div>

            <div className="border-t border-slate-100">
              {pieceJointeEnAttente && (
                <div className="px-3 pt-3 flex items-center gap-2">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-primary-50 border border-primary-200 rounded-lg text-xs text-primary-700 max-w-full">
                    <Paperclip className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{pieceJointeEnAttente.nom}</span>
                    <button onClick={() => setPieceJointeEnAttente(null)} className="text-primary-500 hover:text-primary-800 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )}
              <div className="p-3 flex items-center gap-1">
                <EmojiPicker onPick={(e) => setTexte((c) => c + e)} />
                <div className="shrink-0">
                  <UploadButton
                    endpoint="messagePieceJointe"
                    appearance={{
                      container: "!w-auto !m-0",
                      button: "!w-9 !h-9 !p-0 !min-h-0 !rounded-full !bg-transparent !text-slate-400 hover:!text-primary-600 hover:!bg-primary-50 !shadow-none !ring-0 !text-[0px] ut-uploading:!bg-transparent after:!bg-primary-500",
                      allowedContent: "!hidden",
                    }}
                    content={{ button: () => <Paperclip className="w-5 h-5" /> }}
                    onUploadBegin={() => setUploading(true)}
                    onClientUploadComplete={(res) => {
                      setUploading(false);
                      const file = res?.[0];
                      if (file) setPieceJointeEnAttente({ url: file.url, nom: file.name, type: file.type ?? "application/octet-stream", taille: file.size });
                    }}
                    onUploadError={(err) => { setUploading(false); toast.error(err.message || "Échec de l'envoi du fichier"); }}
                  />
                </div>
                <input
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
                  placeholder="Écrivez un message…"
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-full text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button onClick={envoyer} disabled={sending || uploading || (!texte.trim() && !pieceJointeEnAttente)}
                  className="p-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-full transition-colors shrink-0">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
