"use client";

import { useEffect, useRef, useState } from "react";

/** Anime un nombre de sa valeur précédente vers sa nouvelle valeur (effet "compteur"). */
export default function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const [affiche, setAffiche] = useState(0);
  const depart = useRef(0);

  useEffect(() => {
    const from = depart.current;
    const to = value;
    if (from === to) return;
    const duree = 700;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duree);
      const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const courant = Math.round(from + (to - from) * ease);
      setAffiche(courant);
      if (p < 1) raf = requestAnimationFrame(tick);
      else depart.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{format ? format(affiche) : affiche.toLocaleString("fr-FR")}</>;
}
