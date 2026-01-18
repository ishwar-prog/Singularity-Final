import React from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const DISASTER_PRECAUTIONS = {
  earthquake: {
    icon: "🏚️",
    precautions: [
      "Drop, Cover, and Hold On - Get under sturdy furniture immediately",
      "Stay away from windows, mirrors, and heavy objects that could fall",
      "If outdoors, move to an open area away from buildings and power lines",
      "Do not use elevators - use stairs only during evacuation",
      "After shaking stops, check for gas leaks and structural damage"
    ]
  },
  flood: {
    icon: "🌊",
    precautions: [
      "Move to higher ground immediately - avoid low-lying areas",
      "Never walk or drive through flood water - 6 inches can knock you down",
      "Turn off electricity and gas if flooding is imminent",
      "Avoid contact with flood water - it may be contaminated",
      "Stay away from moving water and damaged power lines"
    ]
  },
  cyclone: {
    icon: "🌀",
    precautions: [
      "Stay indoors in a sturdy building away from windows",
      "Secure loose objects outside that could become projectiles",
      "Stock emergency supplies: water, food, flashlight, first aid kit",
      "Listen to local authorities and evacuate if ordered",
      "Stay in interior rooms on lower floors during the storm"
    ]
  },
  hurricane: {
    icon: "🌪️",
    precautions: [
      "Board up windows and secure outdoor items",
      "Evacuate if in a coastal or low-lying area",
      "Stock at least 3 days of water and non-perishable food",
      "Fill bathtubs with water for sanitation",
      "Stay away from windows and glass doors during the storm"
    ]
  },
  tornado: {
    icon: "🌪️",
    precautions: [
      "Seek shelter in a basement or interior room on lowest floor",
      "Get under sturdy furniture and protect your head and neck",
      "Stay away from windows, doors, and outside walls",
      "If in a vehicle, do not try to outrun - seek sturdy shelter",
      "If caught outside, lie flat in a ditch and cover your head"
    ]
  },
  landslide: {
    icon: "⛰️",
    precautions: [
      "Evacuate immediately if you hear rumbling or see cracks in ground",
      "Move away from the path of the landslide - go perpendicular to flow",
      "Stay alert during heavy rainfall in hilly areas",
      "Watch for tilted trees, fences, or sudden changes in water flow",
      "Do not return to affected area until authorities declare it safe"
    ]
  },
  fire: {
    icon: "🔥",
    precautions: [
      "Evacuate immediately - do not gather belongings",
      "Stay low to avoid smoke inhalation - crawl if necessary",
      "Feel doors before opening - if hot, use alternate route",
      "Close doors behind you to slow fire spread",
      "Once out, stay out - never re-enter a burning building"
    ]
  },
  wildfire: {
    icon: "🔥",
    precautions: [
      "Evacuate early if advised - do not wait for mandatory orders",
      "Close all windows and doors to prevent embers entering",
      "Wear N95 mask or cloth to protect from smoke",
      "If trapped, stay in a cleared area away from vegetation",
      "Monitor air quality and stay indoors if smoke is heavy"
    ]
  },
  heatwave: {
    icon: "☀️",
    precautions: [
      "Stay hydrated - drink water even if not thirsty",
      "Avoid outdoor activities during peak heat (10am-4pm)",
      "Stay in air-conditioned spaces or use fans",
      "Never leave children or pets in vehicles",
      "Check on elderly neighbors and those without AC"
    ]
  },
  tsunami: {
    icon: "🌊",
    precautions: [
      "Move to high ground immediately - at least 100 feet elevation",
      "Do not wait for official warning if you feel earthquake near coast",
      "Stay away from beach and coastal areas for several hours",
      "Listen for emergency alerts and follow evacuation routes",
      "Do not return until authorities declare all-clear"
    ]
  },
  storm: {
    icon: "⛈️",
    precautions: [
      "Stay indoors and away from windows",
      "Unplug electrical appliances to prevent damage from power surges",
      "Avoid using landline phones during lightning",
      "If caught outside, seek shelter immediately - avoid trees and metal objects",
      "Wait 30 minutes after last thunder before going outside"
    ]
  },
  drought: {
    icon: "🏜️",
    precautions: [
      "Conserve water - limit non-essential usage",
      "Store emergency water supply for drinking and sanitation",
      "Protect crops and livestock with available water resources",
      "Be prepared for potential wildfires due to dry conditions",
      "Follow local water restrictions and conservation guidelines"
    ]
  },
  default: {
    icon: "⚠️",
    precautions: [
      "Stay informed through official channels and emergency alerts",
      "Keep emergency kit ready: water, food, flashlight, first aid",
      "Have evacuation plan and know safe routes",
      "Keep phone charged and have backup power source",
      "Follow instructions from local authorities immediately"
    ]
  }
};

export default function PrecautionsSection({ disasterType, urgency, className }) {
  const normalizedType = disasterType?.toLowerCase().trim() || 'default';
  const precautionData = DISASTER_PRECAUTIONS[normalizedType] || DISASTER_PRECAUTIONS.default;
  
  const urgencyColors = {
    critical: "border-red-500/50 bg-red-500/10",
    high: "border-orange-500/50 bg-orange-500/10",
    medium: "border-yellow-500/50 bg-yellow-500/10",
    low: "border-green-500/50 bg-green-500/10"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border-2 p-5 backdrop-blur-xl",
        urgencyColors[urgency?.toLowerCase()] || "border-blue-500/50 bg-blue-500/10",
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-white/10">
          <Shield className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>{precautionData.icon}</span>
            Safety Precautions
          </h3>
          <p className="text-sm text-slate-400 capitalize">
            {normalizedType === 'default' ? 'General Safety' : `${normalizedType} Safety Guidelines`}
          </p>
        </div>
      </div>

      {urgency && urgency.toLowerCase() === 'critical' && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-bold text-sm">CRITICAL SITUATION</p>
            <p className="text-red-200 text-xs mt-1">Follow these precautions immediately and evacuate if instructed</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {precautionData.precautions.map((precaution, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-start gap-3 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-sm shrink-0">
              {idx + 1}
            </div>
            <p className="text-slate-200 text-sm leading-relaxed">{precaution}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-xs text-slate-500 text-center">
          Always follow local authority instructions and emergency services guidance
        </p>
      </div>
    </motion.div>
  );
}

export { DISASTER_PRECAUTIONS };
