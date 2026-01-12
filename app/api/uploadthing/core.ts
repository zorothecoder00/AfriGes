import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {   
  proprieteImage: f({ image: { maxFileSize: "4MB", maxFileCount: 5 } }) // 5 images max
    .onUploadComplete(async ({ file }) => {
      console.log("✅ Fichier uploadé avec succès :", file.url);
      return { url: file.url };
    }),
} satisfies FileRouter;   

export type OurFileRouter = typeof ourFileRouter;
    