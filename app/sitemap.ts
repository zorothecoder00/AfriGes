import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/email";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${appUrl()}/catalogue`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];
}
