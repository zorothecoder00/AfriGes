// /types/next-auth.d.ts
import { DefaultSession, DefaultUser } from "next-auth";
import { Role } from "prisma/client";  

// On étend les types User, Session et JWT
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      nom: string;
      prenom: string;
      role: Role| null; // ton enum
      photo?: string;  
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    nom: string;
    prenom: string;
    role: Role| null; // ton enum
    photo?: string;
  }

  interface JWT {
    id: string;
    role: Role| null;
    nom: string;
    prenom: string;
    photo?: string // 👈 facultatif, si photo existe
  }
}

