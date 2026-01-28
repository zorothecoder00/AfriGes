import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';    
    
export async function PUT(       
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try{
    const session = await getAuthSession();
    // ✅ Vérification session + rôle
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await context.params;
    const { valeur } = await req.json();

    // ✅ Règle métier
    if (!id.startsWith("cotisation_")) {
      return NextResponse.json({ error: "Clé invalide" }, { status: 400 });
    }

    if (!valeur || typeof valeur !== "string") {
      return NextResponse.json({ error: "Valeur invalide" }, { status: 400 });
    }

    const exists = await prisma.parametre.findUnique({
      where: { cle: id }
    });

    if (!exists) {
      return NextResponse.json({ error: "Option introuvable" }, { status: 404 });
    }

    const updated = await prisma.parametre.update({   
      where: { cle: id },
      data: { valeur },
    });

  } catch (error) {
    console.error("PUT /admin/cotisations/options/[id]", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try{
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await context.params;

    // ✅ Règle métier
    if (!id.startsWith("cotisation_")) {
      return NextResponse.json({ error: "Clé invalide" }, { status: 400 });
    }

    const exists = await prisma.parametre.findUnique({
      where: { cle: id }
    });

    if (!exists) {
      return NextResponse.json({ error: "Option introuvable" }, { status: 404 } );
    }

    await prisma.parametre.delete({ where: { cle: id } });

    return NextResponse.json({ message: "Option supprimée avec succès" }, { status: 200 });
  } catch (error) {
    console.error("DELETE /admin/cotisations/options/[id]", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}