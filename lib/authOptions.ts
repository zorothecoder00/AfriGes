import { prisma } from '@/lib/prisma'
import { Role, RoleGestionnaire } from "@/types"
import bcrypt from 'bcryptjs'     
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { NextAuthOptions } from 'next-auth'
    
export const authOptions: NextAuthOptions = {
	providers: [      
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,

		}),   

		CredentialsProvider({
			name: "Credentials",
			credentials: {
				email: { label: "Email", type: "text" },
				password: { label: "Password", type: "password" }
			},
			async authorize(credentials){
				// Vérifie ton utilisateur dans la DB (via Prisma par ex.)
				const user = await prisma.user.findUnique({
					where: { email: credentials?.email },
				})
				if (user && credentials?.password && user.passwordHash) {
					const validPassword = await bcrypt.compare(
					   credentials.password,
					   user.passwordHash
					);

					if (!validPassword) return null;

					return {  
						id: String(user.id),
						nom: user.nom,
						prenom: user.prenom,
						name: `${user.prenom}  ${user.nom}`,// NextAuth attend un champ name
						email: user.email,
						role: user.role,
						photo: user.photo ?? undefined,
					}
				}
				return null
			}
		})
	], 
	callbacks: {
		async signIn({ user, account }) {  
	      // Si c'est Google → vérifier s'il existe déjà dans ta DB
	      if (account?.provider === "google") {
	        const existingUser = await prisma.user.findUnique({ where: { email: user.email! } })
	        if (!existingUser) {
   
	          // Séparer le prénom et le nom depuis Google "name"
	          const [prenom, ...rest] = user.name?.split(" ") ?? ["Inconnu"]
	          const nom = rest.join(" ") || "Inconnu"

	          // optionnel : créer l’utilisateur en DB
	          await prisma.user.create({
	            data: {
	              email: user.email!,
	              passwordHash: null,
	              prenom,    
	              nom,
	              photo: user.image,
	              role: null
	            }
	          })     
 
	          // Forcer la redirection vers /chooseRole
      		  return "/chooseRole";
	        }

	        // S’il n’a pas encore choisi de rôle
		    if (!existingUser.role) {
		      return "/chooseRole";
		    }
	      }
	      return true
	    },
		async jwt({ token, user }){
			if(user){
				token.id = user.id
				token.prenom = user.prenom ?? user.name?.split(" ")[0]
				token.nom = user.nom ?? user.name?.split(" ").slice(1).join(" ")
				token.photo = user.photo ?? user.image ?? null
				token.role = user.role ?? null

				// Récupérer le rôle gestionnaire depuis la DB
				const gestionnaire = await prisma.gestionnaire.findUnique({
					where: { memberId: Number(user.id) },
					select: { role: true },
				})
				token.gestionnaireRole = gestionnaire?.role ?? null
			}
			return token
		},
		async session({ session, token }){
			if (session.user) {
				session.user.id = token.id as string;
				session.user.prenom = token.prenom as string;
				session.user.nom = token.nom as string;
				session.user.photo = (token.photo as string) ?? null
		        session.user.role = token.role as Role ?? null;
		        session.user.gestionnaireRole = (token.gestionnaireRole as RoleGestionnaire) ?? null;
			}
			return session
		},
		
	},

	session: {
		strategy: "jwt",
		maxAge: 60 * 60,//1heure en secondes 
	},
	jwt: {
		maxAge: 60 * 60,
	},
	pages: {
	    signIn: "/auth/login", // page login
	    error: "/auth/login"   // ⚠️ ici on redirige l'erreur vers login
	},
	
}
