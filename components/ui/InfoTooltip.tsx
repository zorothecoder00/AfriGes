"use client";

import { Info } from "lucide-react";

/** Petite icône ⓘ avec bulle explicative au survol/focus — pour clarifier un indicateur. */
export default function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex align-middle ml-1">
      <Info size={12} className="text-slate-300 hover:text-slate-500 cursor-help transition-colors" tabIndex={0} />
      <span className="pointer-events-none absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg bg-slate-800 text-white text-[11px] leading-snug px-2.5 py-1.5 text-left font-normal normal-case tracking-normal opacity-0 scale-95 group-hover/tip:opacity-100 group-hover/tip:scale-100 group-focus-within/tip:opacity-100 group-focus-within/tip:scale-100 transition-all duration-150 shadow-lg">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </span>
    </span>
  );
}
