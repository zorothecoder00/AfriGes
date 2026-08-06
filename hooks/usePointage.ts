"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";

export interface PointageToday {
  id:            number;
  date:          string;
  heureArrivee:  string | null;
  heureDepart:   string | null;
  statut:        string;
  source:        string;
  tempsTotal:    number | null;
  retardMinutes: number | null;
  heuresSup:     number | null;
  valideParId:   number | null;
}

export interface TodayResponse {
  profilRH:      { id: number; matricule: string } | null;
  pointage:      PointageToday | null;
  configHoraire: { heureArrivee: string | null; heureDepart: string | null } | null;
}

export interface HistoriqueItem {
  id:           number;
  date:         string;
  statut:       string;
  tempsTotal:   number | null;
  heureArrivee: string | null;
  heureDepart:  string | null;
  source:       string;
}

/**
 * Logique de pointage collaborateur (self-service), partagée entre le bouton
 * flottant (PointageWidget) et le badge fusionné du profil (UserPdvBadge) —
 * les deux affichent le même panneau (PointagePanel) mais avec un déclencheur
 * différent selon que la page a déjà son propre bloc profil ou non.
 */
export function usePointage() {
  const [open,        setOpen]        = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [refreshKey,  setRefreshKey]  = useState(0);

  const { data: todayData, loading: todayLoading } =
    useApi<TodayResponse>(`/api/collaborateur/pointage/today?_=${refreshKey}`);

  const { data: histData } =
    useApi<{ data: HistoriqueItem[] }>(
      showHistory ? `/api/collaborateur/pointage?limit=7&_=${refreshKey}` : null,
    );

  // Ferme le panneau avec Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const pointer = useCallback(async (action: "ARRIVEE" | "DEPART") => {
    setLoading(true);
    try {
      const res = await fetch("/api/collaborateur/pointage", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Erreur lors du pointage");
      } else {
        toast.success(action === "ARRIVEE" ? "Arrivée pointée ✓" : "Départ pointé ✓");
        setRefreshKey(k => k + 1);
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  const pointageToday = todayData?.pointage ?? null;
  const config        = todayData?.configHoraire ?? null;

  const peutArrivee = !pointageToday;
  const peutDepart  = !!pointageToday && !pointageToday.heureDepart && pointageToday.source === "SELF_SERVICE";
  const saisiRH     = !!pointageToday && pointageToday.source !== "SELF_SERVICE";
  const valide      = !!pointageToday?.valideParId;

  // null tant que le chargement initial n'est pas terminé (évite un flash de
  // contenu erroné) ; ensuite true/false selon la présence d'un dossier RH.
  const hasProfilRH = todayLoading ? null : todayData?.profilRH != null;

  return {
    open, setOpen, showHistory, setShowHistory, loading,
    todayData, todayLoading, histData,
    pointer,
    pointageToday, config, peutArrivee, peutDepart, saisiRH, valide, hasProfilRH,
  };
}

export type UsePointageReturn = ReturnType<typeof usePointage>;
