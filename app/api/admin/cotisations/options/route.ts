import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';          
     
export async function GET(req: Request) {     
  const session = await getAuthSession();
  // ✅ Vérification session + rôle
  if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  
  const options = await prisma.parametre.findMany({
    where: { cle: { startsWith: 'cotisation_' } },
  });

  return NextResponse.json({ data: options });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { cle, valeur } = await req.json();
  const option = await prisma.parametre.create({ data: { cle, valeur } });

  return NextResponse.json({ data: option });
}