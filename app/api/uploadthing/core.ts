import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getAuthSession } from "@/lib/auth";

const f = createUploadthing();

export const ourFileRouter = {
  // Endpoint existant — images de propriétés
  proprieteImage: f({ image: { maxFileSize: "4MB", maxFileCount: 5 } })
    .onUploadComplete(async ({ file }) => {
      // Ne pas exposer les URLs de fichiers dans les logs de production.
      if (process.env.NODE_ENV === "development") {
        console.log("✅ Fichier uploadé avec succès :", file.url);
      }
      return { url: file.url };
    }),

  // Endpoint pièces jointes de la messagerie — ouvert à tout utilisateur connecté
  messagePieceJointe: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    pdf:   { maxFileSize: "16MB", maxFileCount: 1 },
    blob:  { maxFileSize: "16MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await getAuthSession();
      if (!session) throw new Error("Non autorisé");
      return { uploaderUserId: Number(session.user.id) };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        url: file.url, name: file.name, size: file.size, type: file.type,
        uploaderUserId: metadata.uploaderUserId,
      };
    }),

  // Endpoint documents du dossier collaborateur RH (CNI, diplômes, contrats…) — admin uniquement
  documentCollaborateur: f({
    pdf:   { maxFileSize: "16MB", maxFileCount: 10 },
    image: { maxFileSize: "8MB",  maxFileCount: 10 },
  })
    .middleware(async () => {
      const session = await getAuthSession();
      if (!session) throw new Error("Non autorisé");
      const { role, gestionnaireRole } = session.user;
      if (role !== "ADMIN" && role !== "SUPER_ADMIN" && gestionnaireRole !== "RESPONSABLE_RH") {
        throw new Error("Accès réservé à l'administrateur ou au responsable RH");
      }
      return { uploaderUserId: Number(session.user.id) };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        url: file.url, name: file.name, size: file.size, type: file.type,
        uploaderUserId: metadata.uploaderUserId,
      };
    }),

  // Endpoint pièces justificatives comptables — CDC §14 : PDF, JPG, PNG, "Excel
  // si nécessaire" (uploadthing n'a pas de catégorie xlsx dédiée, `blob` couvre
  // les autres formats de document, Excel compris, par type MIME).
  justificatif: f({
    pdf:   { maxFileSize: "16MB", maxFileCount: 5 },
    image: { maxFileSize: "8MB",  maxFileCount: 5 },
    blob:  { maxFileSize: "16MB", maxFileCount: 5 },
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
  // Endpoint bibliothèque de contenu Marketing (photos, vidéos, affiches,
  // flyers… CDC Marketing §29) — réservé au marketing.
  contenuMarketingMedia: f({
    image: { maxFileSize: "8MB", maxFileCount: 5 },
    video: { maxFileSize: "64MB", maxFileCount: 1 },
    pdf:   { maxFileSize: "16MB", maxFileCount: 5 },
  })
    .middleware(async () => {
      const session = await getAuthSession();
      if (!session) throw new Error("Non autorisé");
      const { role, gestionnaireRole } = session.user;
      if (role !== "ADMIN" && role !== "SUPER_ADMIN" && gestionnaireRole !== "RESPONSABLE_MARKETING") {
        throw new Error("Accès réservé au marketing");
      }
      return { uploaderUserId: Number(session.user.id) };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        url:            file.url,
        key:            file.key,
        name:           file.name,
        size:           file.size,
        type:           file.type,
        uploaderUserId: metadata.uploaderUserId,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
