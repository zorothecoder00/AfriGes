"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";

/**
 * Zone de signature tracée au doigt, au stylet ou à la souris (pointer events) — la signature
 * est rendue en PNG (data URL) via `onChange`, ou `null` quand la zone est vide/effacée.
 * Le tracé est imprimé tel quel sur les documents ; la validation horodatée de l'acteur
 * reste la signature électronique de référence (voir BordereauRemiseFonds).
 */
export default function SignaturePad({
  onChange,
  label = "Signature",
  hauteur = 150,
}: {
  onChange: (dataUrl: string | null) => void;
  label?: string;
  hauteur?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const traceEnCours = useRef(false);
  const dernierPoint = useRef<{ x: number; y: number } | null>(null);
  const aTrace = useRef(false);
  const [vide, setVide] = useState(true);

  // Dimensionne le canvas à sa taille affichée × densité d'écran (trait net sur mobile).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b3d91";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const debut = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    traceEnCours.current = true;
    dernierPoint.current = point(e);
  };

  const trace = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!traceEnCours.current || !dernierPoint.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(dernierPoint.current.x, dernierPoint.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dernierPoint.current = p;
    if (!aTrace.current) { aTrace.current = true; setVide(false); }
  };

  const fin = () => {
    if (!traceEnCours.current) return;
    traceEnCours.current = false;
    dernierPoint.current = null;
    const canvas = canvasRef.current;
    if (canvas && aTrace.current) onChange(canvas.toDataURL("image/png"));
  };

  const effacer = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    aTrace.current = false;
    setVide(true);
    onChange(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 flex items-center gap-1"><PenLine className="w-3.5 h-3.5" /> {label}</span>
        <button type="button" onClick={effacer} className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1">
          <Eraser className="w-3.5 h-3.5" /> Effacer
        </button>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={debut}
          onPointerMove={trace}
          onPointerUp={fin}
          onPointerLeave={fin}
          onPointerCancel={fin}
          style={{ height: hauteur, touchAction: "none" }}
          className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-white cursor-crosshair"
        />
        {vide && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-300">
            Signez ici (doigt, stylet ou souris)
          </span>
        )}
      </div>
    </div>
  );
}
