import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Send, Loader2, ShieldAlert, Activity, Shield, ShieldCheck, ShieldX, ShieldQuestion,
  Flame, Waves, Wind, MapPin, Users, Clock, Phone, Radio, FileText, Globe, AlertOctagon,
  Image as ImageIcon, Link2, MessageSquare, Upload, X, CheckCircle2, XCircle, AlertCircle,
  Navigation, ExternalLink, TrendingUp, TrendingDown, Zap, Eye, DollarSign, Calendar,
  BadgeCheck, Skull, HeartPulse, Home, UserX, CircleDollarSign, Target
} from 'lucide-react';
import axios from 'axios';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import LocationMap from './LocationMap';
import PrecautionsSection from './PrecautionsSection';
import NearbyDisasters from './NearbyDisasters';
import api from '../config/api';

const cn = (...inputs) => twMerge(clsx(inputs));

// Platform config for display
const PLATFORM_ICONS = {
  usgs: { icon: "🏛️", color: "bg-emerald-600" },
  noaa: { icon: "🌀", color: "bg-blue-700" },
  fema: { icon: "🏛️", color: "bg-blue-800" },
  reuters: { icon: "📰", color: "bg-orange-600" },
  ap_news: { icon: "AP", color: "bg-red-600" },
  bbc: { icon: "📻", color: "bg-red-800" },
  cnn: { icon: "📺", color: "bg-red-700" },
  nytimes: { icon: "📰", color: "bg-slate-700" },
  twitter: { icon: "𝕏", color: "bg-black" },
  reddit: { icon: "⬆️", color: "bg-orange-500" },
  facebook: { icon: "f", color: "bg-blue-600" },
  instagram: { icon: "📷", color: "bg-gradient-to-br from-purple-600 to-pink-500" },
  youtube: { icon: "▶️", color: "bg-red-600" },
  tiktok: { icon: "♪", color: "bg-black" },
  image_upload: { icon: "🖼️", color: "bg-purple-600" },
  image_url: { icon: "🖼️", color: "bg-purple-600" },
  user_report: { icon: "👤", color: "bg-indigo-600" },
  web: { icon: "🌐", color: "bg-slate-600" },
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 120, damping: 15 } }
};

// ============== COMPONENTS ==============

const GlowCard = ({ children, className, glowColor = "slate", animate = false }) => {
  const glowMap = {
    red: "hover:shadow-red-500/30 hover:border-red-500/40",
    orange: "hover:shadow-orange-500/30 hover:border-orange-500/40",
    yellow: "hover:shadow-yellow-500/30 hover:border-yellow-500/40",
    green: "hover:shadow-green-500/30 hover:border-green-500/40",
    blue: "hover:shadow-blue-500/30 hover:border-blue-500/40",
    purple: "hover:shadow-purple-500/30 hover:border-purple-500/40",
    pink: "hover:shadow-pink-500/30 hover:border-pink-500/40",
    slate: "hover:shadow-slate-500/20 hover:border-slate-500/30",
  };

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ scale: 1.01 }}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.07] to-white/[0.02]",
        "border border-white/10 backdrop-blur-xl shadow-xl transition-all duration-300",
        glowMap[glowColor],
        animate && "animate-pulse",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 p-5">{children}</div>
    </motion.div>
  );
};

const CredibilityMeter = ({ credibility }) => {
  const score = credibility?.percentage || 0;
  const status = credibility?.status || "unknown";

  const colorMap = {
    verified: { bg: "bg-green-500", text: "text-green-400", glow: "shadow-green-500/50" },
    likely_credible: { bg: "bg-emerald-500", text: "text-emerald-400", glow: "shadow-emerald-500/50" },
    needs_verification: { bg: "bg-yellow-500", text: "text-yellow-400", glow: "shadow-yellow-500/50" },
    suspicious: { bg: "bg-orange-500", text: "text-orange-400", glow: "shadow-orange-500/50" },
    likely_fake: { bg: "bg-red-500", text: "text-red-400", glow: "shadow-red-500/50" },
  };

  const colors = colorMap[status] || colorMap.needs_verification;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 uppercase tracking-wider">Trust Score</span>
        <span className={cn("text-3xl font-bold", colors.text)}>{score}%</span>
      </div>
      <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn("h-full rounded-full shadow-lg", colors.bg, colors.glow)}
        />
      </div>
      <div className={cn("text-center py-2 rounded-lg font-bold text-sm", colors.bg + "/20", colors.text)}>
        {credibility?.status_text || "UNKNOWN"}
      </div>
    </div>
  );
};

const FactorsList = ({ factors }) => (
  <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
    {factors?.map((factor, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.05 }}
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg text-sm",
          factor.positive ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"
        )}
      >
        {factor.positive ? (
          <TrendingUp className="w-4 h-4 text-green-400 shrink-0" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
        )}
        <span className={factor.positive ? "text-green-300" : "text-red-300"}>{factor.factor}</span>
        <span className="ml-auto text-xs opacity-60 font-mono">{factor.impact}</span>
      </motion.div>
    ))}
  </div>
);

const WorkflowSteps = ({ steps }) => (
  <div className="flex flex-wrap gap-2">
    {steps?.map((step, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: i * 0.05 }}
        className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-300"
      >
        <CheckCircle2 className="w-3 h-3" />
        {step}
      </motion.div>
    ))}
  </div>
);

const DonationAnalysis = ({ analysis }) => {
  if (!analysis || analysis.donation_trust === "none_found") {
    return <p className="text-slate-500 text-sm italic">No donation links detected</p>;
  }

  const trustColors = {
    verified: "text-green-400 bg-green-500/20 border-green-500/30",
    scam_likely: "text-red-400 bg-red-500/20 border-red-500/30",
    unverified: "text-yellow-400 bg-yellow-500/20 border-yellow-500/30",
  };

  return (
    <div className="space-y-3">
      <div className={cn("px-3 py-2 rounded-lg border text-center font-semibold", trustColors[analysis.donation_trust])}>
        {analysis.donation_trust === "verified" && "✓ VERIFIED CHARITY LINKS"}
        {analysis.donation_trust === "scam_likely" && "⚠️ SCAM INDICATORS DETECTED"}
        {analysis.donation_trust === "unverified" && "? UNVERIFIED DONATION LINKS"}
      </div>

      {analysis.scam_indicators_found?.length > 0 && (
        <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          <p className="text-xs text-red-400 font-semibold mb-2">🚨 Scam Indicators:</p>
          <div className="flex flex-wrap gap-1">
            {analysis.scam_indicators_found.map((ind, i) => (
              <span key={i} className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-xs">{ind}</span>
            ))}
          </div>
        </div>
      )}

      {analysis.legitimate_charities_found?.length > 0 && (
        <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/20">
          <p className="text-xs text-green-400 font-semibold mb-2">✓ Verified Charities:</p>
          <div className="flex flex-wrap gap-1">
            {analysis.legitimate_charities_found.map((charity, i) => (
              <span key={i} className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs">{charity}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const InputTabs = ({ mode, setMode }) => {
  const tabs = [
    { id: 'text', label: 'Text', icon: MessageSquare },
    { id: 'url', label: 'URL', icon: Link2 },
    { id: 'image', label: 'Image', icon: ImageIcon },
  ];

  return (
    <div className="flex bg-black/30 p-1 rounded-xl border border-white/10">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setMode(tab.id)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all",
            mode === tab.id
              ? "bg-white/10 text-white shadow-lg border border-white/10"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          <tab.icon className="w-4 h-4" />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

const PeopleEstimates = ({ estimates }) => {
  if (!estimates || Object.keys(estimates).length === 0) return null;

  const icons = {
    affected: Users,
    displaced: Home,
    dead: Skull,
    injured: HeartPulse,
    evacuated: Navigation,
    missing: UserX
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {Object.entries(estimates).map(([key, value]) => {
        const Icon = icons[key] || Users;
        return (
          <div key={key} className="bg-black/20 p-3 rounded-lg text-center">
            <Icon className="w-5 h-5 mx-auto mb-1 text-slate-400" />
            <p className="text-lg font-bold text-white">{value?.toLocaleString()}</p>
            <p className="text-xs text-slate-500 capitalize">{key}</p>
          </div>
        );
      })}
    </div>
  );
};

const VerificationReport = ({ result, onClose }) => {
  if (!result) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-950">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Full Verification Report</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <div className={cn("p-4 rounded-xl text-center min-w-[100px]",
              result.credibility?.score >= 0.8 ? "bg-green-500/20 text-green-400" :
                result.credibility?.score >= 0.4 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"
            )}>
              <div className="text-3xl font-bold">{result.credibility?.percentage}%</div>
              <div className="text-xs font-bold uppercase mt-1">Trust Score</div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{result.credibility?.status_text}</h3>
              <p className="text-slate-400 text-sm mt-1">{result.credibility?.recommendation}</p>
            </div>
          </div>

          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Detailed Factor Breakdown</h3>
          <div className="space-y-3">
            {result.credibility?.factors?.map((factor, i) => (
              <div key={i} className={cn("p-4 rounded-xl border flex gap-4",
                factor.positive ? "bg-green-950/20 border-green-500/20" : "bg-red-950/20 border-red-500/20"
              )}>
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  factor.positive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                )}>
                  {factor.positive ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className={cn("font-bold text-sm", factor.positive ? "text-green-300" : "text-red-300")}>
                    {factor.category}
                  </h4>
                  <p className="text-white font-medium mt-1">{factor.factor}</p>
                  {factor.description && (
                    <p className="text-slate-400 text-sm mt-1 leading-relaxed">{factor.description}</p>
                  )}
                  <div className="mt-2 inline-block px-2 py-0.5 rounded text-xs bg-black/20 font-mono text-slate-500">
                    Impact: {factor.impact}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============== MAIN COMPONENT ==============

export default function DisasterAgent() {
  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis' or 'nearby'
  const [inputMode, setInputMode] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [theme, setTheme] = useState('neutral');
  const fileInputRef = useRef(null);
  const mapRef = useRef(null); // Reference to scroll to map

  const themeColors = {
    neutral: "from-slate-950 via-slate-900 to-slate-950",
    critical: "from-red-950/40 via-slate-950 to-red-950/40",
    high: "from-orange-950/40 via-slate-950 to-orange-950/40",
    medium: "from-yellow-950/40 via-slate-950 to-yellow-950/40",
    low: "from-green-950/40 via-slate-950 to-green-950/40",
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImageUrl('');
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setTheme('neutral');

    try {
      let response;

      if (inputMode === 'text' && textInput.trim()) {
        response = await axios.post(api.endpoints.analyze, { text: textInput, source: 'user' });
      } else if (inputMode === 'url' && urlInput.trim()) {
        response = await axios.post(api.endpoints.analyze, { text: urlInput, source: 'web' });
      } else if (inputMode === 'image') {
        if (imageFile) {
          const formData = new FormData();
          formData.append('file', imageFile);
          response = await axios.post(api.endpoints.analyzeImageUpload, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } else if (imageUrl) {
          response = await axios.post(api.endpoints.analyzeImage, { image_url: imageUrl });
        }
      }

      if (response?.data) {
        setResult(response.data);
        const urgency = response.data.urgency?.toLowerCase();
        if (['critical', 'high', 'medium', 'low'].includes(urgency)) {
          setTheme(urgency);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setResult({
        error: error.response?.data?.detail || "Analysis failed. Please ensure the backend is running on port 8000."
      });
    } finally {
      setLoading(false);
    }
  };



  const getPlatformDisplay = (platform) => {
    const config = PLATFORM_ICONS[platform] || PLATFORM_ICONS.web;
    return config;
  };

  return (
    <div className={cn(
      "min-h-screen transition-all duration-1000 ease-in-out font-sans text-slate-100 p-4 md:p-6 bg-gradient-to-br",
      themeColors[theme]
    )}>
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
              className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10"
            >
              <ShieldAlert className="w-10 h-10 text-blue-400" />
            </motion.div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-slate-300">
                Disaster Intelligence Agent
              </h1>
              <p className="text-slate-400 text-sm">AI Analysis • Credibility Verification • Scam Detection</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Agent Status */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/30 border border-white/5">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-ping absolute" />
                <div className="w-2 h-2 rounded-full bg-green-500 relative" />
              </div>
              <span className="text-xs font-mono text-slate-400">AGENT ONLINE</span>
            </div>
          </div>
        </motion.header>

        {/* Main Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex bg-black/30 p-1 rounded-xl border border-white/10"
        >
          <button
            onClick={() => setActiveTab('analysis')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all",
              activeTab === 'analysis'
                ? "bg-white/10 text-white shadow-lg border border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <ShieldAlert className="w-5 h-5" />
            <span>Disaster Analysis</span>
          </button>
          <button
            onClick={() => setActiveTab('nearby')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all",
              activeTab === 'nearby'
                ? "bg-white/10 text-white shadow-lg border border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Target className="w-5 h-5" />
            <span>Nearby Disasters</span>
          </button>
        </motion.div>

        {/* Content based on active tab */}
        {activeTab === 'nearby' ? (
          <NearbyDisasters />
        ) : (
          <>
            {/* Input Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl p-4 md:p-5 backdrop-blur-xl"
            >
              <div className="space-y-4">
                <InputTabs mode={inputMode} setMode={setInputMode} />

                <form onSubmit={handleSubmit} className="space-y-4">
                  <AnimatePresence mode="wait">
                    {inputMode === 'text' && (
                      <motion.textarea
                        key="text"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="Paste disaster report, social media post, news article text, or any emergency information..."
                        className="w-full h-32 bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-slate-100 focus:ring-2 focus:ring-blue-500/50 transition-all resize-none placeholder:text-slate-500"
                      />
                    )}

                    {inputMode === 'url' && (
                      <motion.div
                        key="url"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                      >
                        <div className="relative">
                          <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                          <input
                            type="url"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="https://twitter.com/..., https://earthquake.usgs.gov/..., any news URL"
                            className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl pl-12 pr-4 py-4 text-slate-100 focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-500"
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-2 pl-2">
                          ✓ Auto-detects: USGS, NOAA, FEMA, Twitter, Reddit, BBC, CNN, Reuters, AP News, and 15+ more platforms
                        </p>
                      </motion.div>
                    )}

                    {inputMode === 'image' && (
                      <motion.div
                        key="image"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-4"
                      >
                        <div className="relative">
                          <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                          <input
                            type="url"
                            value={imageUrl}
                            onChange={(e) => { setImageUrl(e.target.value); setImageFile(null); setImagePreview(e.target.value); }}
                            placeholder="Paste image URL..."
                            className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl pl-12 pr-4 py-3 text-slate-100 focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-slate-500"
                          />
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-px bg-slate-700" />
                          <span className="text-xs text-slate-500">OR UPLOAD</span>
                          <div className="flex-1 h-px bg-slate-700" />
                        </div>

                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="border-2 border-dashed border-slate-700 hover:border-purple-500/50 rounded-xl p-6 text-center cursor-pointer transition-all hover:bg-purple-500/5"
                        >
                          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                          <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                          <p className="text-slate-400 text-sm">Click to upload image</p>
                        </div>

                        {imagePreview && (
                          <div className="relative">
                            <img src={imagePreview} alt="Preview" className="w-full max-h-40 object-contain rounded-xl border border-slate-700" />
                            <button
                              type="button"
                              onClick={() => { setImagePreview(null); setImageFile(null); setImageUrl(''); }}
                              className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full hover:bg-red-500"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        <p className="text-xs text-amber-400/80 text-center">
                          ⚠️ Location will be extracted from image content only (visual cues, text in image)
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loading || (!textInput && !urlInput && !imageUrl && !imageFile)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold shadow-lg shadow-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5" />
                          Analyze
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>

            {/* Results */}
            <AnimatePresence mode="wait">
              {result && !result.error && (
                <motion.div
                  key="results"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  {/* Agent Workflow Banner */}
                  {result.agent_workflow && (
                    <GlowCard className="col-span-full" glowColor="blue">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-semibold text-slate-200">Agent Workflow Completed</span>
                        <span className="text-xs text-slate-500 ml-auto">{result.agent_workflow.model_used}</span>
                      </div>
                      <WorkflowSteps steps={result.agent_workflow.steps_completed} />
                    </GlowCard>
                  )}

                  {/* Main Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                    {/* Disaster Type & Urgency */}
                    <GlowCard className="lg:col-span-2" glowColor={theme === 'critical' ? 'red' : theme === 'high' ? 'orange' : theme === 'low' ? 'green' : 'yellow'}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Detected Incident</p>
                          <h2 className="text-3xl font-bold text-white capitalize">{result.disaster_type}</h2>
                        </div>
                        <span className="text-xs bg-white/10 px-2 py-1 rounded font-mono">{result.request_id?.slice(0, 8)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className={cn(
                          "px-4 py-2 rounded-xl font-bold text-sm border-2",
                          result.urgency === 'critical' && "bg-red-500/20 text-red-400 border-red-500/50",
                          result.urgency === 'high' && "bg-orange-500/20 text-orange-400 border-orange-500/50",
                          result.urgency === 'medium' && "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
                          result.urgency === 'low' && "bg-green-500/20 text-green-400 border-green-500/50",
                        )}>
                          {result.urgency?.toUpperCase()} PRIORITY
                        </div>
                        <div className="px-3 py-1.5 bg-slate-800/50 rounded-lg text-sm">
                          <span className="text-slate-400">Need: </span>
                          <span className="text-white capitalize">{result.need_type}</span>
                        </div>
                        <div className="px-3 py-1.5 bg-slate-800/50 rounded-lg text-sm">
                          <span className="text-slate-400">AI Conf: </span>
                          <span className="text-white">{Math.round((result.confidence || 0) * 100)}%</span>
                        </div>
                      </div>
                    </GlowCard>

                    {/* Credibility Score */}
                    <GlowCard className="lg:col-span-1" glowColor={result.credibility?.status === 'verified' ? 'green' : result.credibility?.status === 'likely_fake' ? 'red' : 'yellow'}>
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-5 h-5 text-slate-400" />
                        <span className="text-sm font-semibold text-slate-200">Credibility</span>
                      </div>
                      <CredibilityMeter credibility={result.credibility} />
                    </GlowCard>

                    {/* Source Platform */}
                    <GlowCard className="lg:col-span-1" glowColor="purple">
                      <div className="flex items-center gap-2 mb-3">
                        <Radio className="w-5 h-5 text-purple-400" />
                        <span className="text-sm font-semibold text-slate-200">Source</span>
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg", getPlatformDisplay(result.source_analysis?.platform).color)}>
                          {getPlatformDisplay(result.source_analysis?.platform).icon}
                        </span>
                        <div>
                          <p className="font-medium text-white">{result.source_analysis?.platform_name}</p>
                          <p className="text-xs text-slate-500">Tier {result.source_analysis?.trust_tier} Source</p>
                        </div>
                      </div>
                      {result.source_analysis?.is_official_source && (
                        <div className="flex items-center gap-1 text-green-400 text-xs bg-green-500/10 px-2 py-1 rounded">
                          <BadgeCheck className="w-3 h-3" /> Official Source
                        </div>
                      )}
                    </GlowCard>

                    {/* Analysis Summary */}
                    <GlowCard className="lg:col-span-2" glowColor="blue">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-semibold text-slate-200">Analysis Summary</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{result.normalized_text}</p>

                      {result.people_estimates && Object.keys(result.people_estimates).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <p className="text-xs text-slate-500 uppercase mb-3">Impact Estimates</p>
                          <PeopleEstimates estimates={result.people_estimates} />
                        </div>
                      )}
                    </GlowCard>

                    {/* Location */}
                    <GlowCard className="lg:col-span-2" glowColor="green">
                      <div ref={mapRef} className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-green-400" />
                          <span className="text-sm font-semibold text-slate-200">Location</span>
                        </div>
                        {(result.location?.latitude || result.map_data?.epicenter) && (
                          <a
                            href={`https://www.google.com/maps?q=${result.map_data?.epicenter?.lat || result.location.latitude},${result.map_data?.epicenter?.lng || result.location.longitude}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                          >
                            <ExternalLink className="w-3 h-3" /> View Map
                          </a>
                        )}
                      </div>

                      {(result.location?.city || result.location?.latitude || result.map_data?.epicenter) ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                            <p className="text-xl font-light text-white">
                              {result.map_data?.epicenter?.name || result.location.city || "Coordinates Available"}
                            </p>
                            <p className="text-sm text-slate-400">
                              {result.map_data?.epicenter?.name
                                ? `${result.map_data.nearby_locations?.length || 0} nearby areas within 100km`
                                : [result.location.region, result.location.country].filter(Boolean).join(", ")
                              }
                            </p>
                          </div>

                          {/* Embedded Mini Map */}
                          {(result.location?.latitude || result.map_data?.epicenter) && (
                            <div className="relative rounded-lg overflow-hidden border border-green-500/20">
                              <div style={{ height: '250px', width: '100%' }}>
                                <LocationMap
                                  location={result.location}
                                  disasterType={result.disaster_type}
                                  urgency={result.urgency}
                                  peopleAffected={result.people_affected || result.people_estimates?.affected}
                                  mapData={result.map_data}
                                />
                              </div>
                            </div>
                          )}

                          {(result.location?.latitude || result.map_data?.epicenter) && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-black/20 p-2 rounded-lg text-center">
                                <p className="text-xs text-slate-500">LAT</p>
                                <p className="font-mono text-sm">
                                  {(result.map_data?.epicenter?.lat || result.location.latitude)?.toFixed?.(4) ||
                                    result.map_data?.epicenter?.lat || result.location.latitude}
                                </p>
                              </div>
                              <div className="bg-black/20 p-2 rounded-lg text-center">
                                <p className="text-xs text-slate-500">LONG</p>
                                <p className="font-mono text-sm">
                                  {(result.map_data?.epicenter?.lng || result.location.longitude)?.toFixed?.(4) ||
                                    result.map_data?.epicenter?.lng || result.location.longitude}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-slate-500">
                          <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">{result.location?.raw_text || "Location Unknown"}</p>
                        </div>
                      )}
                    </GlowCard>

                    {/* Credibility Factors */}
                    <GlowCard className="lg:col-span-2" glowColor="yellow">
                      <div className="flex items-center gap-2 mb-3">
                        <Eye className="w-5 h-5 text-yellow-400" />
                        <span className="text-sm font-semibold text-slate-200">Verification Factors</span>
                      </div>
                      <FactorsList factors={result.credibility?.factors} />
                      {result.credibility?.recommendation && (
                        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                          <p className="text-sm text-slate-300">{result.credibility.recommendation}</p>
                        </div>
                      )}
                      <button
                        onClick={() => setShowReport(true)}
                        className="w-full mt-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium transition-colors border border-slate-700"
                      >
                        View Full Verification Report
                      </button>
                    </GlowCard>

                    {/* Donation Analysis */}
                    <GlowCard className="lg:col-span-2" glowColor={result.donation_analysis?.donation_trust === 'scam_likely' ? 'red' : 'green'}>
                      <div className="flex items-center gap-2 mb-3">
                        <CircleDollarSign className="w-5 h-5 text-emerald-400" />
                        <span className="text-sm font-semibold text-slate-200">Donation Link Analysis</span>
                      </div>
                      <DonationAnalysis analysis={result.donation_analysis} />
                    </GlowCard>

                    {/* Safety Precautions Section */}
                    <div className="lg:col-span-4">
                      <PrecautionsSection
                        disasterType={result.disaster_type}
                        urgency={result.urgency}
                      />
                    </div>

                  </div>
                </motion.div>
              )}

              {/* Error State */}
              {result?.error && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center"
                >
                  <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                  <h3 className="text-xl font-semibold text-red-300 mb-2">Analysis Failed</h3>
                  <p className="text-slate-400">{result.error}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Report Modal */}
        <AnimatePresence>
          {showReport && result && (
            <VerificationReport result={result} onClose={() => setShowReport(false)} />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
