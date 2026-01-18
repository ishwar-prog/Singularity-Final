import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Navigation, Loader2, AlertTriangle, Shield, 
  Radio, Clock, AlertOctagon, RefreshCw, Target, Zap, X
} from 'lucide-react';
import axios from 'axios';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import api from '../config/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const cn = (...inputs) => twMerge(clsx(inputs));

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DISASTER_PRECAUTIONS = {
  earthquake: [
    "Drop, Cover, and Hold On - Get under sturdy furniture immediately",
    "Stay away from windows, mirrors, and heavy objects that could fall",
    "If outdoors, move to an open area away from buildings and power lines",
    "Do not use elevators - use stairs only during evacuation",
    "After shaking stops, check for gas leaks and structural damage"
  ],
  flood: [
    "Move to higher ground immediately - avoid low-lying areas",
    "Never walk or drive through flood water - 6 inches can knock you down",
    "Turn off electricity and gas if flooding is imminent",
    "Avoid contact with flood water - it may be contaminated",
    "Stay away from moving water and damaged power lines"
  ],
  cyclone: [
    "Stay indoors in a sturdy building away from windows",
    "Secure loose objects outside that could become projectiles",
    "Stock emergency supplies: water, food, flashlight, first aid kit",
    "Listen to local authorities and evacuate if ordered",
    "Stay in interior rooms on lower floors during the storm"
  ],
  hurricane: [
    "Board up windows and secure outdoor items",
    "Evacuate if in a coastal or low-lying area",
    "Stock at least 3 days of water and non-perishable food",
    "Fill bathtubs with water for sanitation",
    "Stay away from windows and glass doors during the storm"
  ],
  tornado: [
    "Seek shelter in a basement or interior room on lowest floor",
    "Get under sturdy furniture and protect your head and neck",
    "Stay away from windows, doors, and outside walls",
    "If in a vehicle, do not try to outrun - seek sturdy shelter",
    "If caught outside, lie flat in a ditch and cover your head"
  ],
  landslide: [
    "Evacuate immediately if you hear rumbling or see cracks in ground",
    "Move away from the path of the landslide - go perpendicular to flow",
    "Stay alert during heavy rainfall in hilly areas",
    "Watch for tilted trees, fences, or sudden changes in water flow",
    "Do not return to affected area until authorities declare it safe"
  ],
  fire: [
    "Evacuate immediately - do not gather belongings",
    "Stay low to avoid smoke inhalation - crawl if necessary",
    "Feel doors before opening - if hot, use alternate route",
    "Close doors behind you to slow fire spread",
    "Once out, stay out - never re-enter a burning building"
  ],
  wildfire: [
    "Evacuate early if advised - do not wait for mandatory orders",
    "Close all windows and doors to prevent embers entering",
    "Wear N95 mask or cloth to protect from smoke",
    "If trapped, stay in a cleared area away from vegetation",
    "Monitor air quality and stay indoors if smoke is heavy"
  ],
  heatwave: [
    "Stay hydrated - drink water even if not thirsty",
    "Avoid outdoor activities during peak heat (10am-4pm)",
    "Stay in air-conditioned spaces or use fans",
    "Never leave children or pets in vehicles",
    "Check on elderly neighbors and those without AC"
  ],
  tsunami: [
    "Move to high ground immediately - at least 100 feet elevation",
    "Do not wait for official warning if you feel earthquake near coast",
    "Stay away from beach and coastal areas for several hours",
    "Listen for emergency alerts and follow evacuation routes",
    "Do not return until authorities declare all-clear"
  ],
  default: [
    "Stay informed through official channels and emergency alerts",
    "Keep emergency kit ready: water, food, flashlight, first aid",
    "Have evacuation plan and know safe routes",
    "Keep phone charged and have backup power source",
    "Follow instructions from local authorities immediately"
  ]
};

const DisasterDetailModal = ({ disaster, onClose }) => {
  if (!disaster) return null;

  const precautions = DISASTER_PRECAUTIONS[disaster.type?.toLowerCase()] || DISASTER_PRECAUTIONS.default;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className={cn(
          "p-5 border-b border-slate-700 flex justify-between items-center",
          disaster.severity === 'critical' && "bg-red-950/50",
          disaster.severity === 'high' && "bg-orange-950/50",
          disaster.severity === 'moderate' && "bg-yellow-950/50",
          disaster.severity === 'low' && "bg-green-950/50"
        )}>
          <div>
            <h2 className="text-2xl font-bold text-white capitalize">{disaster.type}</h2>
            <p className="text-slate-400">{disaster.city}, {disaster.region}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Severity</span>
              </div>
              <p className={cn(
                "text-2xl font-bold uppercase",
                disaster.severity === 'critical' && "text-red-400",
                disaster.severity === 'high' && "text-orange-400",
                disaster.severity === 'moderate' && "text-yellow-400",
                disaster.severity === 'low' && "text-green-400"
              )}>{disaster.severity}</p>
            </div>
            <div className="bg-black/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                <Navigation className="w-4 h-4" />
                <span>Distance</span>
              </div>
              <p className="text-2xl font-bold text-white">{disaster.distance_km} km</p>
            </div>
            <div className="bg-black/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                <Clock className="w-4 h-4" />
                <span>Last Reported</span>
              </div>
              <p className="text-lg font-bold text-white">{disaster.last_reported}</p>
            </div>
            <div className="bg-black/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                <Radio className="w-4 h-4" />
                <span>Source</span>
              </div>
              <p className="text-lg font-bold text-white">{disaster.source}</p>
            </div>
          </div>

          <div className="bg-black/20 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <MapPin className="w-4 h-4" />
              <span>Coordinates</span>
            </div>
            <p className="text-white font-mono">{disaster.latitude.toFixed(4)}, {disaster.longitude.toFixed(4)}</p>
          </div>

          <div className="border-t border-white/10 pt-4">
            <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              Safety Precautions
            </h4>
            <ul className="space-y-3">
              {precautions.map((precaution, idx) => (
                <li key={idx} className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-sm shrink-0">
                    {idx + 1}
                  </div>
                  <p className="text-slate-200 text-sm leading-relaxed">{precaution}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function NearbyDisasters() {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [disasters, setDisasters] = useState([]);
  const [error, setError] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [selectedDisaster, setSelectedDisaster] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const getUserLocation = () => {
    setLoading(true);
    setError(null);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });
        
        try {
          const response = await axios.post(api.endpoints.nearbyDisasters, {
            latitude,
            longitude,
            radius_km: 50
          });
          
          setDisasters(response.data.disasters || []);
        } catch (err) {
          console.error('API Error:', err);
          setError(
            err.response?.data?.detail || 
            err.message || 
            "Failed to fetch nearby disasters. Please ensure the backend is running on port 8000."
          );
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLocationError(
          err.code === 1 ? "Location access denied. Please enable location permissions." :
          err.code === 2 ? "Location unavailable. Please check your device settings." :
          err.code === 3 ? "Location request timed out. Please try again." :
          "Failed to get your location"
        );
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    getUserLocation();
  }, []);

  useEffect(() => {
    if (!location || disasters.length === 0) return;

    // Initialize map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapRef.current).setView([location.latitude, location.longitude], 10);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add 50km radius circle
    L.circle([location.latitude, location.longitude], {
      radius: 50000,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      weight: 2,
      dashArray: '10, 10'
    }).addTo(map);

    // Add user location marker
    const userIcon = L.divIcon({
      className: 'user-marker',
      html: '<div style="font-size: 32px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">📍</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    L.marker([location.latitude, location.longitude], { icon: userIcon })
      .addTo(map)
      .bindPopup(`
        <div style="min-width: 150px;">
          <h3 style="font-weight: bold; margin-bottom: 8px;">Your Location</h3>
          <p style="font-size: 12px; color: #666;">Monitoring 50km radius</p>
        </div>
      `);

    // Add disaster markers
    disasters.forEach((disaster) => {
      const severityColors = {
        critical: '#ef4444',
        high: '#f97316',
        moderate: '#eab308',
        low: '#22c55e'
      };

      const disasterIcon = L.divIcon({
        className: 'disaster-marker',
        html: `<div style="
          font-size: 28px; 
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
          cursor: pointer;
          filter: drop-shadow(0 0 8px ${severityColors[disaster.severity] || '#eab308'});
        ">⚠️</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28]
      });

      const marker = L.marker([disaster.latitude, disaster.longitude], { icon: disasterIcon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width: 200px;">
            <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px; text-transform: capitalize; color: ${severityColors[disaster.severity]};">
              ${disaster.type}
            </h3>
            <p><strong>Severity:</strong> <span style="color: ${severityColors[disaster.severity]}; text-transform: uppercase;">${disaster.severity}</span></p>
            <p><strong>Location:</strong> ${disaster.city}</p>
            <p><strong>Distance:</strong> ${disaster.distance_km} km</p>
            <p><strong>Reported:</strong> ${disaster.last_reported}</p>
            <button 
              onclick="window.showDisasterDetails(${disasters.indexOf(disaster)})"
              style="
                margin-top: 8px;
                padding: 6px 12px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                width: 100%;
              "
            >View Details</button>
          </div>
        `);

      marker.on('click', () => {
        marker.openPopup();
      });
    });

    mapInstanceRef.current = map;

    // Global function for popup button
    window.showDisasterDetails = (index) => {
      setSelectedDisaster(disasters[index]);
    };

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      delete window.showDisasterDetails;
    };
  }, [location, disasters]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10"
        >
          <div className="flex items-center gap-4">
            <motion.div 
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
              className="p-3 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-white/10"
            >
              <Target className="w-10 h-10 text-red-400" />
            </motion.div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-red-100 to-slate-300">
                Nearby Disasters
              </h1>
              <p className="text-slate-400 text-sm">Real-time monitoring within 50km radius</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {location && (
              <div className="px-4 py-2 rounded-xl bg-black/30 border border-white/10">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300">
                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </span>
                </div>
              </div>
            )}
            
            <button
              onClick={getUserLocation}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              <span className="text-sm font-medium">Refresh</span>
            </button>
          </div>
        </motion.header>

        {/* Location Context */}
        {location && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl p-5 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">Your Location</h2>
            </div>
            <p className="text-slate-300">
              Monitoring disasters within <span className="text-blue-400 font-bold">50 km</span> radius
            </p>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
            <p className="text-slate-400">Getting your location and checking for nearby disasters...</p>
          </motion.div>
        )}

        {/* Location Error */}
        {locationError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center"
          >
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h3 className="text-xl font-semibold text-red-300 mb-2">Location Access Required</h3>
            <p className="text-slate-400 mb-4">{locationError}</p>
            <button
              onClick={getUserLocation}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors"
            >
              Try Again
            </button>
          </motion.div>
        )}

        {/* API Error */}
        {error && !locationError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-6 text-center"
          >
            <AlertOctagon className="w-12 h-12 text-orange-400 mx-auto mb-3" />
            <h3 className="text-xl font-semibold text-orange-300 mb-2">Service Error</h3>
            <p className="text-slate-400">{error}</p>
          </motion.div>
        )}

        {/* Interactive Map */}
        {!loading && !locationError && disasters.length > 0 && location && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                Active Disasters ({disasters.length})
              </h2>
            </div>
            
            <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl p-4 backdrop-blur-xl">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-white mb-2">Interactive Map</h3>
                <p className="text-sm text-slate-400">Click on disaster markers (⚠️) to view details</p>
              </div>
              <div 
                ref={mapRef} 
                style={{ height: '500px', width: '100%' }} 
                className="rounded-xl overflow-hidden border border-slate-700/50"
              />
              <div className="mt-4 flex flex-wrap gap-3 justify-center">
                <div className="flex items-center gap-2 px-3 py-2 bg-black/20 rounded-lg">
                  <span className="text-2xl">📍</span>
                  <span className="text-sm text-slate-300">Your Location</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-black/20 rounded-lg">
                  <span className="text-2xl">⚠️</span>
                  <span className="text-sm text-slate-300">Disaster Location</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-black/20 rounded-lg">
                  <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-dashed"></div>
                  <span className="text-sm text-slate-300">50km Radius</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {disasters.map((disaster, idx) => (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setSelectedDisaster(disaster)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left hover:scale-105 transition-all",
                    disaster.severity === 'critical' && "border-red-500/50 bg-red-500/10 hover:bg-red-500/20",
                    disaster.severity === 'high' && "border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20",
                    disaster.severity === 'moderate' && "border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20",
                    disaster.severity === 'low' && "border-green-500/50 bg-green-500/10 hover:bg-green-500/20"
                  )}
                >
                  <div className="text-2xl mb-2">⚠️</div>
                  <h4 className="text-sm font-bold text-white capitalize mb-1">{disaster.type}</h4>
                  <p className="text-xs text-slate-400">{disaster.distance_km} km away</p>
                  <div className={cn(
                    "mt-2 text-xs font-bold uppercase",
                    disaster.severity === 'critical' && "text-red-400",
                    disaster.severity === 'high' && "text-orange-400",
                    disaster.severity === 'moderate' && "text-yellow-400",
                    disaster.severity === 'low' && "text-green-400"
                  )}>
                    {disaster.severity}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* No Disasters Found */}
        {!loading && !locationError && !error && disasters.length === 0 && location && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center"
          >
            <Shield className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-green-300 mb-2">No Active Disasters</h3>
            <p className="text-slate-400 mb-6">No disasters detected within 50 km of your location</p>
            
            <div className="bg-black/20 rounded-xl p-6 max-w-2xl mx-auto">
              <h4 className="text-lg font-bold text-white mb-4 flex items-center justify-center gap-2">
                <Zap className="w-5 h-5 text-blue-400" />
                General Safety Readiness Tips
              </h4>
              <ul className="space-y-3 text-left">
                {DISASTER_PRECAUTIONS.default.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-slate-300">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}

      </div>

      {/* Disaster Detail Modal */}
      <AnimatePresence>
        {selectedDisaster && (
          <DisasterDetailModal 
            disaster={selectedDisaster} 
            onClose={() => setSelectedDisaster(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
