import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/email";

/**
 * AfriGes est majoritairement une app privée (dashboards authentifiés).
 * Seule la vitrine `/catalogue` (Catalogue §21-24) est destinée à l'indexation.
 * Le reste est explicitement exclu, y compris les routes qui embarquent des
 * jetons/références sensibles dans l'URL (/scan, /suivi).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/catalogue",
      disallow: ["/dashboard", "/api", "/auth", "/scan", "/suivi", "/unauthorized"],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
