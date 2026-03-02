import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getAuthSession } from "@/lib/auth";

const f = createUploadthing();

export const ourFileRouter = {
  // Endpoint existant — images de propriétés
  proprieteImage: f({ image: { maxFileSize: "4MB", maxFileCount: 5 } })
    .onUploadComplete(async ({ file }) => {
      console.log("✅ Fichier uploadé avec succès :", file.url);
      return { url: file.url };
    }),

  // Endpoint pièces justificatives comptables
  justificatif: f({
    pdf:   { maxFileSize: "16MB", maxFileCount: 5 },
    image: { maxFileSize: "8MB",  maxFileCount: 5 },
  })
    .middleware(async () => {
      const session = await getAuthSession();
      if (!session) throw new Error("Non autorisé");
      const { role, gestionnaireRole } = session.user;
      if (role !== "ADMIN" && role !== "SUPER_ADMIN" && gestionnaireRole !== "COMPTABLE") {
        throw new Error("Accès réservé au comptable");
      }
      return { uploaderUserId: Number(session.user.id) };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        url:             file.url,
        key:             file.key,
        name:            file.name,
        size:            file.size,
        type:            file.type,
        uploaderUserId:  metadata.uploaderUserId,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
