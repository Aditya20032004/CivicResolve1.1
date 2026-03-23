import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { IncidentReport } from '../types';
import L from 'leaflet';

// Use CDN URLs for Leaflet assets to ensure compatibility in the browser ESM environment
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

// Apply the fix to all markers
L.Marker.prototype.options.icon = DefaultIcon;

interface IncidentMapProps {
  incidents: IncidentReport[];
  center?: [number, number];
  zoom?: number;
}

// Focus the map and incident markers around Bhopal.
const BHOPAL_CENTER: [number, number] = [23.2599, 77.4126];
const BHOPAL_RADIUS_DEG = 0.45; // ~50km bounding square

const isWithinBhopalArea = (lat: number, lng: number) => {
  if (lat == null || lng == null) return false;
  return (
    Math.abs(lat - BHOPAL_CENTER[0]) <= BHOPAL_RADIUS_DEG &&
    Math.abs(lng - BHOPAL_CENTER[1]) <= BHOPAL_RADIUS_DEG
  );
};

const IncidentMap: React.FC<IncidentMapProps> = ({ 
  incidents, 
  center = BHOPAL_CENTER, 
  zoom = 13 
}) => {
  const visibleIncidents = incidents.filter((incident) =>
    incident.location &&
    isWithinBhopalArea(incident.location.lat, incident.location.lng)
  );

  return (
    <div className="h-full w-full rounded-xl overflow-hidden shadow-inner border border-gray-200">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {visibleIncidents.map((incident) => (
          <Marker 
            key={incident.id} 
            position={[incident.location.lat, incident.location.lng]}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-indigo-600 uppercase">{incident.type}</p>
                <p className="text-gray-600">{incident.location.address}</p>
                <p className={`mt-1 font-semibold ${incident.status === 'pending' ? 'text-amber-500' : incident.status === 'completed' ? 'text-blue-500' : 'text-emerald-500'}`}>
                  Status: {incident.status}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default IncidentMap;