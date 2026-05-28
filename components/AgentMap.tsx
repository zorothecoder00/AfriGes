'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Fix icônes Leaflet (webpack asset path) ────────────────────────────────
const iconClient = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const iconVisite = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

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

// ── Types ──────────────────────────────────────────────────────────────────

export interface MapClient {
  id: number;
  nom: string;
  prenom: string;
  telephone: string | null;
  codeClient: string | null;
  etat: string;
  latitude: number | null;
  longitude: number | null;
}

export interface MapVisite {
  id: number;
  dateVisite: string;
  statut: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  client: { id: number; nom: string; prenom: string };
}

interface AgentMapProps {
  clients: MapClient[];
  visites: MapVisite[];
  mode: 'clients' | 'tournee';
}

// ── Composant ──────────────────────────────────────────────────────────────

export default function AgentMap({ clients, visites, mode }: AgentMapProps) {
  const clientsAvecGps = clients.filter((c) => c.latitude != null && c.longitude != null);
  const visitesAvecGps = visites.filter((v) => v.latitude != null && v.longitude != null);

  // Points pour auto-fit
  const allPositions: [number, number][] = [
    ...(mode === 'clients' ? clientsAvecGps.map((c) => [c.latitude!, c.longitude!] as [number, number]) : []),
    ...(mode === 'tournee' ? visitesAvecGps.map((v) => [v.latitude!, v.longitude!] as [number, number]) : []),
  ];

  // Tracé de la tournée (polyline reliant les visites dans l'ordre chronologique)
  const tourneePath: [number, number][] = visitesAvecGps.map((v) => [v.latitude!, v.longitude!]);

  const center: [number, number] = allPositions.length > 0 ? allPositions[0] : [6.137, 1.212]; // Lomé par défaut

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {allPositions.length > 0 && <FitBounds positions={allPositions} />}

      {/* Mode clients : épingles bleues */}
      {mode === 'clients' && clientsAvecGps.map((c) => (
        <Marker key={c.id} position={[c.latitude!, c.longitude!]} icon={iconClient}>
          <Popup>
            <div className="text-sm min-w-[160px]">
              <p className="font-bold">{c.prenom} {c.nom}</p>
              {c.codeClient && <p className="text-gray-500 text-xs">{c.codeClient}</p>}
              {c.telephone  && <p className="mt-1">{c.telephone}</p>}
              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                c.etat === 'ACTIF' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>{c.etat}</span>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Mode tournée : tracé vert + marqueurs visites */}
      {mode === 'tournee' && (
        <>
          {tourneePath.length > 1 && (
            <Polyline positions={tourneePath} color="#10b981" weight={3} opacity={0.8} dashArray="6 4" />
          )}
          {visitesAvecGps.map((v, i) => (
            <Marker key={v.id} position={[v.latitude!, v.longitude!]} icon={iconVisite}>
              <Popup>
                <div className="text-sm min-w-[160px]">
                  <p className="font-bold text-xs text-gray-500">Visite #{i + 1}</p>
                  <p className="font-bold">{v.client.prenom} {v.client.nom}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(v.dateVisite).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                  {v.notes && <p className="mt-1 text-xs italic text-gray-600">{v.notes}</p>}
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                    v.statut === 'REALISEE' ? 'bg-green-100 text-green-700' :
                    v.statut === 'PLANIFIEE' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{v.statut}</span>
                </div>
              </Popup>
            </Marker>
          ))}
        </>
      )}
    </MapContainer>
  );
}
