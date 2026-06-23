import { NextResponse } from "next/server";
import { chargerArchiveAnnee, chargerArchiveJour, chargerArchivePlage } from "@/lib/archivage";
import { scopeCaissier } from "@/lib/remboursementScope";

/** GET ?year= → arbre ; ?date= → journée ; ?from=&to= → détail ligne par ligne (PDV du caissier). */
export async function GET(req: Request) {
  const s = await scopeCaissier();
  if (!s.ok) return s.response;
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from"), to = searchParams.get("to");
    if (from && to) return NextResponse.json({ data: await chargerArchivePlage(s.scope.where, new Date(from), new Date(to)) });
    const date = searchParams.get("date");
    if (date) return NextResponse.json({ data: await chargerArchiveJour(s.scope.where, date) });
    const annee = Number(searchParams.get("year")) || new Date().getFullYear();
    return NextResponse.json({ data: await chargerArchiveAnnee(s.scope.where, annee) });
  } catch (error) {
    console.error("GET /api/caissier/archivage", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
