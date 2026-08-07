import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

/**
 * Composeur d'email par blocs (CDC §26) : texte, image, bouton, produit,
 * promotion, lien. Le HTML produit est ensuite passé à
 * `lib/email.ts::renderEmailLayout()` (réutilisé, pas dupliqué) pour
 * l'habillage brandé AfriGes avant envoi via `sendEmail()`.
 */

export type BlocEmail =
  | { type: "TEXTE"; contenu: string }
  | { type: "IMAGE"; url: string; alt?: string }
  | { type: "BOUTON"; texte: string; url: string }
  | { type: "PRODUIT"; produitId: number }
  | { type: "PROMOTION"; promotionId: number }
  | { type: "LIEN"; texte: string; url: string }
  | { type: "COUPON"; couponId: number };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

async function rendererBloc(bloc: BlocEmail): Promise<string> {
  switch (bloc.type) {
    case "TEXTE":
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1e293b;">${esc(bloc.contenu)}</p>`;
    case "IMAGE":
      return `<img src="${esc(bloc.url)}" alt="${esc(bloc.alt ?? "")}" style="max-width:100%;border-radius:8px;margin:0 0 16px;" />`;
    case "BOUTON":
      return `<a href="${esc(bloc.url)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin:0 0 16px;">${esc(bloc.texte)}</a>`;
    case "LIEN":
      return `<p style="margin:0 0 16px;"><a href="${esc(bloc.url)}" style="color:#0f172a;font-weight:600;">${esc(bloc.texte)}</a></p>`;
    case "PRODUIT": {
      const produit = await prisma.produit.findUnique({ where: { id: bloc.produitId }, select: { nom: true, prixUnitaire: true, imagePrincipaleUrl: true } });
      if (!produit) return "";
      return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0 0 16px;">
        ${produit.imagePrincipaleUrl ? `<img src="${esc(produit.imagePrincipaleUrl)}" style="max-width:100%;border-radius:6px;margin-bottom:8px;" />` : ""}
        <p style="margin:0;font-weight:600;color:#1e293b;">${esc(produit.nom)}</p>
        <p style="margin:4px 0 0;color:#0f172a;font-weight:700;">${esc(formatCurrency(Number(produit.prixUnitaire)))}</p>
      </div>`;
    }
    case "PROMOTION": {
      const promo = await prisma.promotion.findUnique({ where: { id: bloc.promotionId }, select: { nom: true, code: true } });
      if (!promo) return "";
      return `<div style="border:2px dashed #0f172a;border-radius:8px;padding:16px;margin:0 0 16px;text-align:center;">
        <p style="margin:0;font-weight:700;color:#0f172a;">${esc(promo.nom)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Code : ${esc(promo.code)}</p>
      </div>`;
    }
    case "COUPON": {
      const coupon = await prisma.coupon.findUnique({ where: { id: bloc.couponId }, select: { nom: true, code: true, description: true } });
      if (!coupon) return "";
      return `<div style="border:2px dashed #db2777;border-radius:8px;padding:16px;margin:0 0 16px;text-align:center;background:#fdf4ff;">
        <p style="margin:0;font-weight:700;color:#a21caf;">${esc(coupon.nom)}</p>
        <p style="margin:6px 0 0;font-size:18px;font-weight:800;letter-spacing:2px;color:#0f172a;">${esc(coupon.code)}</p>
        ${coupon.description ? `<p style="margin:6px 0 0;font-size:13px;color:#64748b;">${esc(coupon.description)}</p>` : ""}
      </div>`;
    }
    default:
      return "";
  }
}

/** Rend un tableau de blocs en HTML (corps de l'email, avant habillage `renderEmailLayout`). */
export async function rendererBlocsEmail(blocs: BlocEmail[]): Promise<string> {
  const rendus = await Promise.all(blocs.map(rendererBloc));
  return rendus.join("\n");
}
