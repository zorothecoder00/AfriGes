"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ViewAsData {
  userId: number;
  gestionnaireRole: string;
  nom: string;
  prenom: string;
  dashboardPath: string;
}

interface ViewAsContextValue {
  viewAs: ViewAsData | null;
  enterViewAs: (data: ViewAsData) => void;
  exitViewAs: () => void;
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

const COOKIE_NAME = "viewAs";

function readViewAsCookie(): ViewAsData | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`)
  );
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as ViewAsData;
  } catch {
    return null;
  }
}

function writeViewAsCookie(data: ViewAsData) {
  const encoded = encodeURIComponent(JSON.stringify(data));
  // 1 heure de validité, SameSite=Lax (pas HttpOnly pour lecture JS)
  document.cookie = `${COOKIE_NAME}=${encoded}; path=/; max-age=3600; SameSite=Lax`;
}

function clearViewAsCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ViewAsContext = createContext<ViewAsContextValue>({
  viewAs: null,
  enterViewAs: () => {},
  exitViewAs: () => {},
});

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [viewAs, setViewAs] = useState<ViewAsData | null>(() =>
    readViewAsCookie()
  );
  const router = useRouter();

  const enterViewAs = useCallback(
    (data: ViewAsData) => {
      writeViewAsCookie(data);
      setViewAs(data);
      router.push(data.dashboardPath);
    },
    [router]
  );

  const exitViewAs = useCallback(() => {
    clearViewAsCookie();
    setViewAs(null);
    // Hard navigation ensures ViewAsProvider re-mounts with the cleared cookie
    window.location.href = "/dashboard/admin/gestionnaires";
  }, []);

  return (
    <ViewAsContext.Provider value={{ viewAs, enterViewAs, exitViewAs }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}
