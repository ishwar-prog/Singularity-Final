import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function generateNearbyPoints(lat, lng, count = 8) {
  const points = [];
  const radiusKm = 100;
  const earthRadiusKm = 6371;

  for (let i = 0; i < count; i++) {
    const angle = (360 / count) * i;
    const distance = radiusKm * (0.3 + Math.random() * 0.6);
    const angleRad = angle * Math.PI / 180;
    const distRad = distance / earthRadiusKm;
    const latRad = lat * Math.PI / 180;
    const lngRad = lng * Math.PI / 180;

    const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(distRad) + Math.cos(latRad) * Math.sin(distRad) * Math.cos(angleRad));
    const newLngRad = lngRad + Math.atan2(Math.sin(angleRad) * Math.sin(distRad) * Math.cos(latRad), Math.cos(distRad) - Math.sin(latRad) * Math.sin(newLatRad));

    points.push({
      name: `Affected Area ${i + 1}`,
      lat: newLatRad * 180 / Math.PI,
      lng: newLngRad * 180 / Math.PI,
      distance_km: distance.toFixed(1),
      type: 'affected_area'
    });
  }

  return points;
}

export default function LocationMap({ location, disasterType, urgency, peopleAffected, mapData }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeMap = () => {
      let centerLat, centerLng, cityName;
      let locations = [];

      console.log('LocationMap: Initializing with data:', { mapData, location });

      if (mapData?.epicenter) {
        centerLat = mapData.epicenter.lat;
        centerLng = mapData.epicenter.lng;
        cityName = mapData.epicenter.name;
        locations = (mapData.nearby_locations || []).map(loc => ({
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng,
          type: 'affected_area'
        }));
      } else if (location?.latitude && location?.longitude) {
        centerLat = parseFloat(location.latitude);
        centerLng = parseFloat(location.longitude);
        cityName = [location.city, location.region, location.country].filter(Boolean).join(', ') || 'Disaster Location';
        locations = generateNearbyPoints(centerLat, centerLng, 8);
      }

      if (!centerLat || !centerLng) {
        console.log('LocationMap: No valid coordinates found');
        setIsLoading(false);
        return;
      }

      console.log('LocationMap: Valid coordinates:', { centerLat, centerLng, cityName });

      const filteredLocations = locations.filter(loc => {
        const dist = calculateDistance(centerLat, centerLng, loc.lat, loc.lng);
        return dist <= 100;
      });

      if (!mapRef.current) {
        console.log('LocationMap: Map container ref not ready yet');
        setIsLoading(false);
        return;
      }

      if (mapInstanceRef.current) {
        console.log('LocationMap: Map already initialized');
        return;
      }

      console.log('LocationMap: Creating map instance...');

      try {
        const bounds = L.latLng(centerLat, centerLng).toBounds(100000);

        const map = L.map(mapRef.current, {
          center: [centerLat, centerLng],
          zoom: 10,
          maxBounds: bounds,
          maxBoundsViscosity: 1.0,
          worldCopyJump: false,
          minZoom: 8,
          maxZoom: 19
        });

        console.log('LocationMap: Map instance created, adding tile layer...');

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        console.log('LocationMap: Adding circle and markers...');

        L.circle([centerLat, centerLng], {
          radius: 100000,
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.1,
          weight: 2,
          dashArray: '10, 10'
        }).addTo(map);

        const centerIcon = L.divIcon({
          className: 'center-marker',
          html: '<div style="font-size: 32px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">🔴</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        });

        L.marker([centerLat, centerLng], { icon: centerIcon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width: 200px;">
              <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px; color: #ef4444;">🔴 DISASTER EPICENTER</h3>
              <p><strong>Type:</strong> ${disasterType || 'Unknown'}</p>
              <p><strong>Location:</strong> ${cityName}</p>
              ${urgency ? `<p><strong>Urgency:</strong> <span style="color: #ef4444; font-weight: bold;">${urgency.toUpperCase()}</span></p>` : ''}
              ${peopleAffected ? `<p><strong>Affected:</strong> ${peopleAffected.toLocaleString()} people</p>` : ''}
              <p style="font-size: 11px; color: #666; margin-top: 8px;">📍 ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}</p>
            </div>
          `)
          .openPopup();

        const areaIcon = L.divIcon({
          className: 'area-marker',
          html: '<div style="font-size: 24px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">🟠</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        filteredLocations.forEach((loc) => {
          const dist = calculateDistance(centerLat, centerLng, loc.lat, loc.lng);
          L.marker([loc.lat, loc.lng], { icon: areaIcon })
            .addTo(map)
            .bindPopup(`
              <div style="min-width: 180px;">
                <h3 style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #f97316;">🟠 Affected Area</h3>
                <p><strong>Location:</strong> ${loc.name}</p>
                <p><strong>Type:</strong> ${loc.type}</p>
                <p><strong>Distance:</strong> ${dist.toFixed(1)} km from epicenter</p>
                <p style="font-size: 11px; color: #666; margin-top: 8px;">📍 ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</p>
              </div>
            `);
        });

        mapInstanceRef.current = map;
        console.log('LocationMap: Map fully initialized!');
        setIsLoading(false);
      } catch (error) {
        console.error('LocationMap: Error initializing map:', error);
        setIsLoading(false);
      }
    };

    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initializeMap();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        console.log('LocationMap: Cleaning up map instance');
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [location, mapData, disasterType, urgency, peopleAffected]);

  if (!location && !mapData) {
    return (
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6 text-center">
        <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">No location data available</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-slate-400 text-sm">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <div className="relative rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl h-full">
        <div ref={mapRef} style={{ height: '100%', width: '100%', minHeight: '250px' }} />

        <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-2 z-1000 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-3 h-3 text-slate-600" />
            <span className="font-semibold text-slate-800 text-xs">100km Radius</span>
          </div>
          <div className="space-y-0.5 text-slate-600 text-xs">
            <div className="flex items-center gap-1.5">
              <span>🔴</span>
              <span>Epicenter</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>🟠</span>
              <span>Affected Areas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
