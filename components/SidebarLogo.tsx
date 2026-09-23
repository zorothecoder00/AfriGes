import Image from "next/image";

/**
 * Logo AfriGes pour l'en-tête des sidebars : l'image source (1254×1254) a des
 * marges blanches ; on n'affiche que la zone dessinée (x 145→1126, y 85→1143),
 * pour que le logo occupe toute la hauteur du bloc sans espace vide.
 * La hauteur se règle via `className` (ex. "h-36") ; la largeur suit le ratio.
 */
const SRC = 1254;
const BOX = { x: 145, y: 85, w: 1126 - 145, h: 1143 - 85 };

export default function SidebarLogo({ className = "h-36", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span
      className={`relative block overflow-hidden ${className}`}
      style={{ aspectRatio: `${BOX.w} / ${BOX.h}` }}
    >
      <Image
        src="/nouveaulogo.jpeg"
        alt="AfriGes"
        width={SRC}
        height={SRC}
        unoptimized
        priority={priority}
        className="absolute max-w-none"
        style={{
          width: `${(SRC / BOX.w) * 100}%`,
          left: `${(-BOX.x / BOX.w) * 100}%`,
          top: `${(-BOX.y / BOX.h) * 100}%`,
        }}
      />
    </span>
  );
}
