import { NextApiRequest, NextApiResponse } from 'next'
import prisma from '@/lib/prisma'
import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'       

export default async function handler(req: NextApiRequest, res: NextApiResponse) 
{
	if(req.method !== 'POST'){  
		return res.status(405).end()
	}

	try{
		const { prenom, nom, role, email, password, photo, telephone, adresse } = req.body
		if (!prenom || !nom || !email || !password) {
      return res.status(400).json({ message: 'Tous les champs requis' })
    }

		const rolesValides = Object.values(Role)
		if(!rolesValides.includes(role)){
			return res.status(400).json({ message: "Le rôle n'est pas valide" })
		}

		// Vérif email valide
	    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	    if (!emailRegex.test(email)) {
	      return res.status(400).json({ message: "Email invalide" })
	    }

	    // Vérif longueur du mot de passe
	    if (password.length < 8) {
	      return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères" })
	    }

		const existingUser = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
	    if (existingUser) {
	      return res.status(400).json({ message: 'Utilisateur déjà inscrit' })
	    }

	    // Vérifier si c'est le premier utilisateur
	    const userCount = await prisma.user.count()

	    const finalRole = userCount === 0 
	      ? Role.SUPER_ADMIN  // le tout premier inscrit est admin
	      : (Object.values(Role).includes(role) ? role as Role : Role.USER)

		const passwordHash = await bcrypt.hash(password, 10)

		const newUser = await prisma.user.create({
			data: {
			  prenom,
			  nom,
			  role: finalRole,
			  email: email.trim().toLowerCase(),
			  passwordHash,
        telephone: telephone || null,
        adresse: adresse || null,
			  photo: photo || '/profile.png',
			}
		})

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { passwordHash:_, ...userSafe } = newUser
		return res.status(201).json({ data: userSafe })
	}catch(error){
		console.error("Erreur interne", error)
		return res.status(500).json({ message: "Erreur interne" })
	}
}