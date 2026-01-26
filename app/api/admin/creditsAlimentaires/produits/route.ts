import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(req: Request) {
  const produits = await prisma.produit.findMany();
  return NextResponse.json(produits);
}

export async function POST(req: Request) {
  const body = await req.json();
  const produit = await prisma.produit.create({ data: body });
  return NextResponse.json(produit);
}