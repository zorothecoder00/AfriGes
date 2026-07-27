'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Auto-fit bounds ────────────────────────────────────────────────────────
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, positions]);
  return null;
}

export interface SiteReseau {
  pointDeVenteId: number;
  nom: string;
  code: string;
  latitude: number | null;
  longitude: number | null;
  regionNom: string;
  valeurEngagee: number;
  nbPO: number;
}

interface StockCarteProps {
  sites: SiteReseau[];
}

const COULEURS_REGION = ['#0891b2', '#7c3aed', '#d97706', '#059669', '#dc2626', '#2563eb', '#db2777'];
function couleurRegion(regionNom: string): string {
  let hash = 0;
  for (let i = 0; i < regionNom.length; i++) hash = (hash * 31 + regionNom.charCodeAt(i)) >>> 0;
  return COULEURS_REGION[hash % COULEURS_REGION.length];
}

// ── Composant ──────────────────────────────────────────────────────────────
// Carte des sites (CDC §14 "carte géographique des stocks nationaux") — un
// cercle par site, rayon proportionnel à l'engagement fournisseurs, couleur
// par plateforme régionale (§4) pour visualiser le regroupement par région.
export default function StockCarte({ sites }: StockCarteProps) {
  const sitesAvecGps = sites.filter((s) => s.latitude != null && s.longitude != null);
  const positions: [number, number][] = sitesAvecGps.map((s) => [s.latitude!, s.longitude!]);
  const maxValeur = Math.max(1, ...sitesAvecGps.map((s) => s.valeurEngagee));
  const center: [number, number] = positions.length > 0 ? positions[0] : [8.6, 1.0]; // Togo par défaut

  if (sitesAvecGps.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-gray-400 bg-gray-50 rounded-xl">
        Aucune coordonnée GPS renseignée sur ces sites.
      </div>
    );
  }

  return (
    <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }} scrollWheelZoom={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {positions.length > 0 && <FitBounds positions={positions} />}
      {sitesAvecGps.map((s, i) => {
        const rayon = 8 + (s.valeurEngagee / maxValeur) * 20;
        return (
          <CircleMarker
            key={`${s.pointDeVenteId}-${i}`}
            center={[s.latitude!, s.longitude!]}
            radius={rayon}
            pathOptions={{ color: couleurRegion(s.regionNom), fillColor: couleurRegion(s.regionNom), fillOpacity: 0.55, weight: 2 }}
          >
            <Popup>
              <div className="text-sm min-w-[160px]">
                <p className="font-bold">{s.nom}</p>
                <p className="text-gray-500 text-xs">{s.code} · {s.regionNom}</p>
                <p className="mt-1">Engagement : <b>{s.valeurEngagee.toLocaleString('fr-FR')} FCFA</b></p>
                <p className="text-xs text-gray-500">{s.nbPO} bon(s) de commande</p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
