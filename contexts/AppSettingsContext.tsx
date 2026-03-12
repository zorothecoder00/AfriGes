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
  const [langue, setLangue] = useState<Langue>(() => {
    if (typeof window === "undefined") return "fr";
    return getStoredSetting("platform.langue", "fr") as Langue;
  });

  useEffect(() => {
    // Initialise uniquement les effets DOM (thème, lang attr, dir)
    initAppSettings();
    // Écoute les changements de stockage (si la même app est ouverte dans plusieurs onglets)
    const listener = () => initAppSettings();
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
