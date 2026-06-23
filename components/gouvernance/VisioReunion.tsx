"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Video, ExternalLink, X, Link2, Save, Loader2 } from "lucide-react";

/** Instance publique Jitsi utilisée pour la visio intégrée. */
const JITSI_DOMAIN = "meet.jit.si";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => any;
  }
}

// Le script externe Jitsi n'est chargé qu'une seule fois pour toute l'appli.
let scriptPromise: Promise<void> | null = null;
function chargerJitsi(): Promise<void> {
  if (typeof window !== "undefined" && window.JitsiMeetExternalAPI) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://${JITSI_DOMAIN}/external_api.js`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptPromise = null; reject(new Error("Chargement de Jitsi impossible")); };
      document.body.appendChild(s);
    });
  }
  return scriptPromise;
}

type PatchPayload = { lienVisio?: string | null; activerVisio?: boolean };

interface Props {
  salle: string | null;
  lienExterne?: string | null;
  titre: string;
  displayName?: string;
  /** Affiche les contrôles d'édition (activer la salle, lien externe). */
  editable?: boolean;
  /** Persiste un changement côté serveur. Retourne true si succès. */
  onPatch?: (payload: PatchPayload) => Promise<boolean>;
}

export default function VisioReunion({ salle, lienExterne, titre, displayName, editable, onPatch }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editLien, setEditLien] = useState(false);
  const [lienDraft, setLienDraft] = useState(lienExterne ?? "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<any>(null);

  // Monte / démonte la conférence Jitsi quand la modale s'ouvre / se ferme.
  useEffect(() => {
    if (!open || !salle) return;
    let cancelled = false;
    chargerJitsi()
      .then(() => {
        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;
        const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
          roomName: salle,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: displayName ? { displayName } : undefined,
          configOverwrite: { prejoinPageEnabled: true },
          interfaceConfigOverwrite: { MOBILE_APP_PROMO: false },
        });
        api.addListener("readyToClose", () => setOpen(false));
        apiRef.current = api;
      })
      .catch(() => { toast.error("Impossible de charger la visioconférence"); setOpen(false); });
    return () => {
      cancelled = true;
      try { apiRef.current?.dispose(); } catch { /* noop */ }
      apiRef.current = null;
    };
  }, [open, salle, displayName]);

  async function activerVisio() {
    if (!onPatch) return;
    setBusy(true);
    const ok = await onPatch({ activerVisio: true });
    setBusy(false);
    if (ok) toast.success("Visioconférence intégrée activée");
  }

  async function enregistrerLien() {
    if (!onPatch) return;
    setBusy(true);
    const ok = await onPatch({ lienVisio: lienDraft.trim() || null });
    setBusy(false);
    if (ok) { toast.success("Lien visio enregistré"); setEditLien(false); }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
        <Video className="w-3.5 h-3.5 text-violet-500" /> Visioconférence
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {salle ? (
          <button onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700">
            <Video className="w-4 h-4" /> Rejoindre la visio
          </button>
        ) : editable ? (
          <button onClick={activerVisio} disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-100 text-violet-700 text-sm font-medium rounded-lg hover:bg-violet-200 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
            Activer la visio intégrée
          </button>
        ) : (
          <span className="text-sm text-slate-400">Aucune visioconférence intégrée.</span>
        )}

        {lienExterne && (
          <a href={lienExterne} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">
            <ExternalLink className="w-4 h-4" /> Lien externe (Meet/Zoom)
          </a>
        )}
      </div>

      {/* Édition du lien externe (organisateur / président) */}
      {editable && onPatch && (
        editLien ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="relative flex-1 min-w-56">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={lienDraft} onChange={e => setLienDraft(e.target.value)}
                placeholder="https://meet.google.com/… ou https://zoom.us/…"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </div>
            <button onClick={enregistrerLien} disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Enregistrer
            </button>
            <button onClick={() => { setEditLien(false); setLienDraft(lienExterne ?? ""); }}
              className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
          </div>
        ) : (
          <button onClick={() => setEditLien(true)}
            className="text-xs text-violet-600 hover:underline flex items-center gap-1">
            <Link2 className="w-3.5 h-3.5" /> {lienExterne ? "Modifier le lien externe" : "Ajouter un lien Meet/Zoom"}
          </button>
        )
      )}

      {/* Modale visio plein écran */}
      {open && salle && (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white">
            <p className="text-sm font-medium flex items-center gap-2 line-clamp-1">
              <Video className="w-4 h-4 text-violet-300" /> {titre}
            </p>
            <button onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 rounded-lg text-sm">
              <X className="w-4 h-4" /> Quitter
            </button>
          </div>
          <div ref={containerRef} className="flex-1 bg-slate-900" />
        </div>
      )}
    </div>
  );
}
