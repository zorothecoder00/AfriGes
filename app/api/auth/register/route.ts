import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { prenom, nom, email, password, telephone, adresse } = body

    // Vérification champs requis
    if (!prenom || !nom || !email || !password) {
      return NextResponse.json(
        { message: 'Tous les champs requis' },
        { status: 400 }
      )
    }

    // Email valide
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: 'Email invalide' },
        { status: 400 }
      )
    }

    // Mot de passe
    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Le mot de passe doit contenir au moins 8 caractères' },
        { status: 400 }
      )
    }

    // Email déjà utilisé
    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    })

    if (existingUser) {
      return NextResponse.json(
        { message: 'Utilisateur déjà inscrit' },
        { status: 400 }
      )
    }

    // Définition du rôle (sécurisé)
    const userCount = await prisma.user.count()
    const finalRole = userCount === 0 ? Role.SUPER_ADMIN : Role.USER

    // Hash mot de passe
    const passwordHash = await bcrypt.hash(password, 10)

    // Création utilisateur
    const newUser = await prisma.user.create({
      data: {
        prenom,
        nom,
        email: email.trim().toLowerCase(),
        passwordHash,
        role: finalRole,
        telephone: telephone || null,
        adresse: adresse || null,
        photo: '/profile.png',
      }
    })

    // Supprimer le hash avant réponse
    const { passwordHash: _, ...userSafe } = newUser

    return NextResponse.json(
      { data: userSafe },
      { status: 201 }
    )

  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { message: 'Erreur interne' },
      { status: 500 }
    )
  }
}
