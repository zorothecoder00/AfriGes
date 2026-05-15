"use client";   

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { initAppSettings, applySettingsToDOM,persistSettings, getStoredSetting } from "@/lib/appSettings";
import { translate, type TranslationKey, type Langue } from "@/lib/translations";
     
interface AppSettingsCtx {
  /** Persiste les paramètres en base ET les applique immédiatement au DOM */
  applyAndPersist: (settings: Record<string, string>) => void;
  /** Langue courante sous forme de React state (déclenche les re-renders) */
  langue: Langue;
  /** Fonction de traduction — t("nav_dashboard") → "Dashboard" */
  t: (key: TranslationKey) => string;
}  
   
const AppSettingsContext = createContext<AppSettingsCtx>({
  applyAndPersist: () => {},
  langue: "fr",
  t: (key) => key,
});

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [langue, setLangue] = useState<Langue>("fr");

  useEffect(() => {
    // 1. Appliquer immédiatement les settings DOM depuis localStorage (pas de setState = pas de re-render)
    initAppSettings();

    // 2. Synchroniser depuis la BDD (async → setState uniquement en callback, jamais synchrone)
    fetch("/api/app-settings")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        const localStored = getStoredSetting("platform.langue", "fr") as Langue;
        if (!json?.success || !json.data) {
          // Fetch échoué → fallback localStorage
          setLangue(localStored);
          return;
        }
        const data: Record<string, string> = json.data;
        // Sync localStorage
        const current = (() => {
          try { return JSON.parse(localStorage.getItem("afriges_app_settings") ?? "{}"); }
          catch { return {}; }
        })();
        localStorage.setItem("afriges_app_settings", JSON.stringify({ ...current, ...data }));
        // Appliquer au DOM
        applySettingsToDOM(data);
        // Un seul setState, en callback async
        const dbLangue = (data["platform.langue"] ?? localStored) as Langue;
        setLangue(dbLangue);
      })
      .catch(() => {
        // Fetch échoué → fallback localStorage
        setLangue(getStoredSetting("platform.langue", "fr") as Langue);
      });

    // 3. Écoute les changements de stockage (multi-onglets)
    const listener = () => {
      setLangue(getStoredSetting("platform.langue", "fr") as Langue);
      initAppSettings();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  const applyAndPersist = useCallback((settings: Record<string, string>) => {
    persistSettings(settings);
    // Update React state si langue a changé
    if (settings["platform.langue"]) {
      setLangue(settings["platform.langue"] as Langue);
      // Applique immédiatement le DOM
      applySettingsToDOM({ "platform.langue": settings["platform.langue"] });
    }
    // Applique le thème immédiatement
    if (settings["platform.theme"]) {
      applySettingsToDOM({ "platform.theme": settings["platform.theme"] });
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translate(key, langue),
    [langue]
  );   

  return (
    <AppSettingsContext.Provider value={{ applyAndPersist, langue, t }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export const useAppSettings = () => useContext(AppSettingsContext);
export const useT = () => useContext(AppSettingsContext).t;
