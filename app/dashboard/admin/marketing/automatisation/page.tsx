import ListeAutomatisation from "@/components/marketing/ListeAutomatisation";
import MesTachesMarketing from "@/components/marketing/MesTachesMarketing";

export default function AutomatisationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Automatisation</h2>
        <p className="text-slate-500 text-sm mt-0.5">Séquences déclencheur → délai → action (CDC §16-20).</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ListeAutomatisation />
        </div>
        <div>
          <MesTachesMarketing />
        </div>
      </div>
    </div>
  );
}
