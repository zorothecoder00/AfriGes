"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { initAppSettings, persistSettings, getStoredSetting } from "@/lib/appSettings";
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
  }, []);

  const applyAndPersist = useCallback((settings: Record<string, string>) => {
    persistSettings(settings);
    // Met à jour le state React si la langue a changé → re-render des composants
    if (settings["platform.langue"]) {
      setLangue(settings["platform.langue"] as Langue);
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
