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
				if (!credentials?.email || !credentials?.password) return null;

				const user = await prisma.user.findUnique({
					where: { email: credentials.email },
				})

				// Email inconnu ou compte sans mot de passe (ex. compte Google) →
				// message générique « identifiants invalides » : on ne révèle jamais
				// si l'email existe (anti-énumération).
				if (!user || !user.passwordHash) return null;

				const validPassword = await bcrypt.compare(
				   credentials.password,
				   user.passwordHash
				);
				if (!validPassword) return null;

				// Mot de passe correct : on peut désormais informer le titulaire légitime
				// de l'état réel de son compte, sans rien divulguer à un tiers (la vérif
				// d'état n'intervient qu'APRÈS la validation du mot de passe).
				if (user.etat === "SUSPENDU" || user.etat === "BLOQUE") {
					throw new Error("ACCOUNT_SUSPENDED");
				}
				if (user.etat !== "ACTIF") {
					// INACTIF, EN_ATTENTE_VALIDATION, REJETE…
					throw new Error("ACCOUNT_INACTIVE");
				}

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
		})
	],
	callbacks: {
		async signIn({ user, account }) {
		  // Google = CONNEXION uniquement. La création de comptes reste réservée à
		  // l'administrateur : un Gmail sans compte pré-existant est refusé. Aucune
		  // auto-inscription, aucun choix de rôle → aucune auto-promotion possible.
		  if (account?.provider === "google") {
		    const existingUser = await prisma.user.findUnique({
		      where:  { email: user.email! },
		      select: { id: true, etat: true },
		    })
		    // Aucun compte pour ce Gmail → refus avec message dédié.
		    if (!existingUser) return "/auth/login?error=GoogleNoAccount"
		    // Compte existant mais non actif → même politique que la connexion par mot de passe.
		    if (existingUser.etat === "SUSPENDU" || existingUser.etat === "BLOQUE")
		      return "/auth/login?error=ACCOUNT_SUSPENDED"
		    if (existingUser.etat !== "ACTIF")
		      return "/auth/login?error=ACCOUNT_INACTIVE"
		  }
		  return true
		},
		async jwt({ token, user, account }){
			if(user){
				// Pour une connexion Google, `user.id` est l'identifiant Google (sub),
				// PAS l'id de notre table User. On résout donc l'utilisateur par email
				// pour récupérer le bon id DB, le rôle, etc. (sinon permissions cassées).
				let dbUserId: number
				if (account?.provider === "google") {
					const g = await prisma.user.findUnique({
						where:  { email: user.email! },
						select: { id: true, prenom: true, nom: true, role: true, photo: true },
					})
					if (!g) { token.error = "SESSION_INVALID"; return token }
					dbUserId     = g.id
					token.id     = String(g.id)
					token.prenom = g.prenom
					token.nom    = g.nom
					token.role   = g.role ?? null
					token.photo  = g.photo ?? user.image ?? null
				} else {
					dbUserId     = Number(user.id)
					token.id     = user.id
					token.prenom = user.prenom ?? user.name?.split(" ")[0]
					token.nom    = user.nom ?? user.name?.split(" ").slice(1).join(" ")
					token.photo  = user.photo ?? user.image ?? null
					token.role   = user.role ?? null
				}
				delete token.error

				// Récupérer le rôle gestionnaire + tokenVersion + mustChangePassword depuis la DB
				const [gestionnaire, dbUser] = await Promise.all([
					prisma.gestionnaire.findUnique({
						where: { memberId: dbUserId },
						select: { role: true },
					}),
					prisma.user.findUnique({
						where: { id: dbUserId },
						select: { tokenVersion: true, mustChangePassword: true },
					}),
				])
				token.gestionnaireRole = gestionnaire?.role ?? null
				token.tokenVersion = dbUser?.tokenVersion ?? 0
				token.mustChangePassword = dbUser?.mustChangePassword ?? false
			} else {
				// Requêtes suivantes : vérifier que le compte est toujours actif
				// et que le token n'a pas été révoqué (force_disconnect)
				// On rafraîchit aussi gestionnaireRole au cas où il a changé depuis le login
				const [dbUser, gestionnaire] = await Promise.all([
					prisma.user.findUnique({
						where: { id: Number(token.id) },
						select: { etat: true, tokenVersion: true, mustChangePassword: true, prenom: true, nom: true, photo: true },
					}),
					prisma.gestionnaire.findUnique({
						where: { memberId: Number(token.id) },
						select: { role: true },
					}),
				])
				if (
					!dbUser ||
					dbUser.etat === "SUSPENDU" ||
					dbUser.tokenVersion !== (token.tokenVersion as number)
				) {
					token.error = "SESSION_INVALID"
				} else {
					delete token.error
					token.mustChangePassword = dbUser.mustChangePassword
					token.gestionnaireRole = gestionnaire?.role ?? null
					// Rafraîchit nom/prénom/photo depuis la DB : la mise à jour du profil
					// (page Paramètres) se reflète alors immédiatement via session.update().
					token.prenom = dbUser.prenom
					token.nom    = dbUser.nom
					token.photo  = dbUser.photo ?? null
				}
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
		        if (token.error) session.user.error = token.error as string;
		        session.user.mustChangePassword = (token.mustChangePassword as boolean) ?? false;
			}
			return session
		},

	},

	session: {
		strategy: "jwt",
		maxAge:    30 * 24 * 60 * 60, // 30 jours
		updateAge: 24 * 60 * 60,      // renouvelle le token une fois par jour si l'user est actif
	},
	jwt: {
		maxAge: 30 * 24 * 60 * 60, // 30 jours
	},
	pages: {
	    signIn: "/auth/login", // page login
	    error: "/auth/login"   // ⚠️ ici on redirige l'erreur vers login
	},

}
