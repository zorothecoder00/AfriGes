// /types/next-auth.d.ts
import { DefaultSession, DefaultUser } from "next-auth";
import { Role, RoleGestionnaire } from "@prisma/client";

// On étend les types User, Session et JWT
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      nom: string;  
      prenom: string;
      role: Role | null;
      gestionnaireRole: RoleGestionnaire | null;
      photo?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    nom: string;
    prenom: string;
    role: Role | null;
    gestionnaireRole?: RoleGestionnaire | null;
    photo?: string;
  }

  interface JWT {
    id: string;
    role: Role | null;
    gestionnaireRole: RoleGestionnaire | null;
    nom: string;
    prenom: string;
    photo?: string;
  }
}

