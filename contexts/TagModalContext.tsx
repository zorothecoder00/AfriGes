"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export interface TagInfo {
  id:      number;
  nom:     string;
  couleur: string;
}

interface TagModalCtx {
  activeTag:  TagInfo | null;
  openTag:    (tag: TagInfo) => void;
  closeTag:   () => void;
}

export const TagModalContext = createContext<TagModalCtx | null>(null);

export function TagModalProvider({ children }: { children: ReactNode }) {
  const [activeTag, setActiveTag] = useState<TagInfo | null>(null);
  return (
    <TagModalContext.Provider value={{
      activeTag,
      openTag:  setActiveTag,
      closeTag: () => setActiveTag(null),
    }}>
      {children}
    </TagModalContext.Provider>
  );
}

export function useTagModal() {
  return useContext(TagModalContext);
}
