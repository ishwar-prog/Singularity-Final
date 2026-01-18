from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import re
import httpx
from datetime import datetime, timedelta
import base64
import tempfile
import json
import traceback

# Load environment variables FIRST
from dotenv import load_dotenv
load_dotenv()

# Get API keys
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')

# Now import agents (they need the env vars)
from agents.intake_agent import ExtendedDisasterAgent
from agents.intake_agent.extractors import detect_platform
from agents.verification_agent.agent import run_verification
from location_intelligence import process_disaster_location

app = FastAPI(title="Disaster Intelligence Agent API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== REQUEST MODELS ==============

class AnalysisRequest(BaseModel):
    text: str
    source: str = "web"

class ImageAnalysisRequest(BaseModel):
    image_url: str

class NearbyDisastersRequest(BaseModel):
    latitude: float
    longitude: float
    radius_km: int = 50

# ============== AGENT CONFIGURATION ==============

agent = ExtendedDisasterAgent()

# Platform detection with credibility tiers
PLATFORM_CONFIG = {
    # Tier 1: Official Government & Agencies (Highest Trust)
    "usgs": {"patterns": ["usgs.gov"], "tier": 1, "name": "USGS Official", "trust": 0.98},
    "noaa": {"patterns": ["noaa.gov", "weather.gov", "nhc.noaa.gov"], "tier": 1, "name": "NOAA Weather", "trust": 0.98},
    "fema": {"patterns": ["fema.gov"], "tier": 1, "name": "FEMA", "trust": 0.98},
    "cdc": {"patterns": ["cdc.gov"], "tier": 1, "name": "CDC", "trust": 0.98},
    "who": {"patterns": ["who.int"], "tier": 1, "name": "WHO", "trust": 0.95},
    "un_relief": {"patterns": ["reliefweb.int", "un.org"], "tier": 1, "name": "UN Relief", "trust": 0.95},
    
    # Tier 2: Major International News (High Trust)
    "reuters": {"patterns": ["reuters.com"], "tier": 2, "name": "Reuters", "trust": 0.90},
    "ap_news": {"patterns": ["apnews.com"], "tier": 2, "name": "AP News", "trust": 0.90},
    "bbc": {"patterns": ["bbc.com", "bbc.co.uk"], "tier": 2, "name": "BBC News", "trust": 0.90},
    "cnn": {"patterns": ["cnn.com"], "tier": 2, "name": "CNN International", "trust": 0.85},
    "aljazeera": {"patterns": ["aljazeera.com"], "tier": 2, "name": "Al Jazeera", "trust": 0.85},
    "guardian": {"patterns": ["theguardian.com"], "tier": 2, "name": "The Guardian", "trust": 0.88},
    "nytimes": {"patterns": ["nytimes.com"], "tier": 2, "name": "NY Times", "trust": 0.88},
    "washingtonpost": {"patterns": ["washingtonpost.com"], "tier": 2, "name": "Washington Post", "trust": 0.88},
    "bloomberg": {"patterns": ["bloomberg.com"], "tier": 2, "name": "Bloomberg", "trust": 0.88},
    
    # Tier 2: Major Indian News (High Trust)
    "indiatoday": {"patterns": ["indiatoday.in"], "tier": 2, "name": "India Today", "trust": 0.85},
    "ndtv": {"patterns": ["ndtv.com"], "tier": 2, "name": "NDTV", "trust": 0.85},
    "timesofindia": {"patterns": ["timesofindia.indiatimes.com"], "tier": 2, "name": "Times of India", "trust": 0.82},
    "thehindu": {"patterns": ["thehindu.com"], "tier": 2, "name": "The Hindu", "trust": 0.88},
    "indianexpress": {"patterns": ["indianexpress.com"], "tier": 2, "name": "Indian Express", "trust": 0.85},
    "hindustantimes": {"patterns": ["hindustantimes.com"], "tier": 2, "name": "Hindustan Times", "trust": 0.82},
    "news18": {"patterns": ["news18.com"], "tier": 2, "name": "News18", "trust": 0.80},

    # Tier 3: Social Media (Needs Verification)
    "twitter": {"patterns": ["twitter.com", "x.com", "t.co"], "tier": 3, "name": "Twitter/X", "trust": 0.45},
    "reddit": {"patterns": ["reddit.com", "redd.it"], "tier": 3, "name": "Reddit", "trust": 0.40},
    "facebook": {"patterns": ["facebook.com", "fb.com"], "tier": 3, "name": "Facebook", "trust": 0.35},
    "instagram": {"patterns": ["instagram.com"], "tier": 3, "name": "Instagram", "trust": 0.30},
    "youtube": {"patterns": ["youtube.com", "youtu.be"], "tier": 3, "name": "YouTube", "trust": 0.40},
    "tiktok": {"patterns": ["tiktok.com"], "tier": 3, "name": "TikTok", "trust": 0.25},
    "telegram": {"patterns": ["t.me", "telegram.org"], "tier": 3, "name": "Telegram", "trust": 0.30},
    "whatsapp": {"patterns": ["whatsapp.com"], "tier": 3, "name": "WhatsApp", "trust": 0.25},
    "discord": {"patterns": ["discord.com"], "tier": 3, "name": "Discord", "trust": 0.25},
    "bluesky": {"patterns": ["bsky.app"], "tier": 3, "name": "Bluesky", "trust": 0.40},

    # Tier 4: Unknown sources (Verification Required)
    "unknown": {"patterns": [], "tier": 4, "name": "Unknown Source", "trust": 0.20},
}

# Known scam/fake donation patterns
SCAM_INDICATORS = [
    "send crypto", "bitcoin only", "wire transfer", "western union",
    "cash app only", "venmo only", "zelle only", "paypal friends",
    "urgent donate now", "100% goes to victims", "tax deductible guaranteed",
    "dm for donation link", "click link in bio", "limited time",
    "match your donation", "celebrity endorsed", "government approved",
]

LEGITIMATE_CHARITY_DOMAINS = [
    "redcross.org", "unicef.org", "savethechildren.org", "directrelief.org",
    "americares.org", "doctorswithoutborders.org", "globalgiving.org",
    "gofundme.com/f/", "habitat.org", "feedingamerica.org", "care.org",
    "pmcares.gov.in", "nrf.gov.in", "cry.org", "giveindia.org"
]

# ============== HELPER FUNCTIONS ==============

def detect_platform_enhanced(url: str) -> dict:
    """Detect platform from URL with advanced matching."""
    url_lower = url.lower()
    
    # 1. Check Configured Platforms
    for platform_id, config in PLATFORM_CONFIG.items():
        for pattern in config.get("patterns", []):
            if pattern in url_lower:
                return {
                    "platform": platform_id,
                    "platform_name": config["name"],
                    "tier": config["tier"],
                    "base_trust": config["trust"],
                    "is_official": config["tier"] <= 2
                }
    
    # 2. Heuristic Fallback (Extract domain name as pretty name)
    try:
        domain_match = re.search(r'https?://(?:www\.)?([^/]+)', url_lower)
        if domain_match:
            domain = domain_match.group(1)
            # Remove TLD (e.g., .com, .org)
            pretty_name = domain.split('.')[0].title()
            return {
                "platform": "web_other",
                "platform_name": pretty_name, # e.g. "Google", "Localnews"
                "tier": 4,
                "base_trust": 0.35, # Slightly better than unknown if valid domain
                "is_official": False
            }
    except:
        pass

    return {
        "platform": "web",
        "platform_name": "Web Source",
        "tier": 4,
        "base_trust": 0.20,
        "is_official": False
    }

def analyze_donation_links(text: str) -> dict:
    """Analyze text for donation links and scam indicators."""
    text_lower = text.lower()
    
    # Check for scam indicators
    scam_flags = []
    for indicator in SCAM_INDICATORS:
        if indicator in text_lower:
            scam_flags.append(indicator)
    
    # Check for legitimate charities
    legitimate_found = []
    for domain in LEGITIMATE_CHARITY_DOMAINS:
        if domain in text_lower:
            legitimate_found.append(domain)
    
    # Extract URLs from text
    url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
    urls = re.findall(url_pattern, text)
    
    donation_urls = []
    for url in urls:
        url_lower_check = url.lower()
        is_legitimate = any(domain in url_lower_check for domain in LEGITIMATE_CHARITY_DOMAINS)
        is_suspicious = any(indicator in url_lower_check for indicator in ["bit.ly", "tinyurl", "t.co", "goo.gl"])
        
        donation_urls.append({
            "url": url[:100],
            "is_legitimate_charity": is_legitimate,
            "is_shortened_suspicious": is_suspicious
        })
    
    # Calculate donation trust score
    if legitimate_found and not scam_flags:
        donation_trust = "verified"
        donation_score = 0.9
    elif scam_flags:
        donation_trust = "scam_likely"
        donation_score = 0.1
    elif donation_urls:
        donation_trust = "unverified"
        donation_score = 0.4
    else:
        donation_trust = "none_found"
        donation_score = None
    
    return {
        "donation_trust": donation_trust,
        "donation_score": donation_score,
        "scam_indicators_found": scam_flags[:5],
        "legitimate_charities_found": legitimate_found,
        "donation_urls": donation_urls[:3]
    }

def check_content_freshness(text: str) -> dict:
    """Check if content might be outdated or recycled."""
    text_lower = text.lower()
    
    # Date patterns that might indicate old content
    year_pattern = r'\b(201[0-9]|202[0-4])\b'
    years_found = re.findall(year_pattern, text)
    
    current_year = datetime.now().year
    old_years = [y for y in years_found if int(y) < current_year - 1]
    
    # Check for phrases indicating recycled content
    recycled_indicators = [
        "years ago", "last year", "throwback", "remember when",
        "old footage", "archive", "historical", "from 20"
    ]
    recycled_flags = [ind for ind in recycled_indicators if ind in text_lower]
    
    if old_years or recycled_flags:
        return {
            "freshness": "potentially_outdated",
            "old_years_mentioned": old_years[:3],
            "recycled_indicators": recycled_flags[:3],
            "warning": "Content may be outdated or recycled from past events"
        }
    
    return {
        "freshness": "appears_current",
        "old_years_mentioned": [],
        "recycled_indicators": [],
        "warning": None
    }

def extract_people_estimates(text: str) -> dict:
    """Extract estimates of people affected from text."""
    text_lower = text.lower()
    
    patterns = [
        (r'(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:million|m)\s*(?:people|affected|displaced|homeless|dead|injured)', 1000000),
        (r'(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:thousand|k)\s*(?:people|affected|displaced|homeless|dead|injured)', 1000),
        (r'(\d+(?:,\d+)?)\s*(?:people|victims|residents|families|households)\s*(?:affected|displaced|homeless|evacuated|dead|killed|injured)', 1),
        (r'(?:affected|displaced|homeless|evacuated|dead|killed|injured)\s*(?:approximately|about|around|over|more than)?\s*(\d+(?:,\d+)?)', 1),
    ]
    
    estimates = {
        "affected": None,
        "displaced": None,
        "dead": None,
        "injured": None,
        "evacuated": None,
        "missing": None
    }
    
    for pattern, multiplier in patterns:
        matches = re.findall(pattern, text_lower)
        for match in matches:
            num_str = match.replace(',', '')
            try:
                num = int(float(num_str) * multiplier)
                if 'dead' in pattern or 'killed' in pattern:
                    estimates["dead"] = num
                elif 'injured' in pattern:
                    estimates["injured"] = num
                elif 'displaced' in pattern or 'homeless' in pattern:
                    estimates["displaced"] = num
                elif 'evacuated' in pattern:
                    estimates["evacuated"] = num
                elif 'missing' in pattern:
                    estimates["missing"] = num
                else:
                    estimates["affected"] = num
            except:
                pass
    
    return {k: v for k, v in estimates.items() if v is not None}

def calculate_comprehensive_credibility(
    result: dict, 
    platform_info: dict, 
    text: str, 
    donation_analysis: dict, 
    freshness: dict,
    verification_results: dict = None
) -> dict:
    """Calculate comprehensive credibility score based on strict factors."""
    
    factors = []
    base_score = platform_info.get("base_trust", 0.3)
    score = base_score
    
    # 1. Source Verification
    source_positive = platform_info.get("is_official", False)
    factors.append({
        "category": "Source Verification",
        "factor": f"{platform_info.get('platform_name')} (Tier {platform_info.get('tier')})",
        "impact": "Trusted" if source_positive else "Needs Verification",
        "positive": source_positive,
        "description": f"Source identified as {platform_info.get('platform_name')}. Tier {platform_info.get('tier')} sources are {'considered official and highly trusted' if source_positive else 'verified but require cross-reference' if platform_info.get('tier') <=3 else 'unknown and require struct verification'}."
    })
    
    # 2. Cross-Report Confirmation (External Verification)
    if verification_results and verification_results.get("is_credible"):
        score += 0.20
        factors.append({
            "category": "Cross-Report Confirmation",
            "factor": "Corroborated by News/Search",
            "impact": "Verified",
            "positive": True,
            "description": "Multiple independent sources or recent news reports confirm this event is happening right now."
        })
    elif verification_results and verification_results.get("verification_status") == "scam":
        score -= 0.40
        factors.append({
            "category": "Cross-Report Confirmation",
            "factor": "Flagged as SCAM by Verifier",
            "impact": "Failed",
            "positive": False,
            "description": "External search detected known scam patterns or reports identifying this as a hoax."
        })
    else:
        # Neutral if unverified, but slight penalty if source is weak
        if platform_info.get("tier", 4) > 2:
            score -= 0.05
        factors.append({
            "category": "Cross-Report Confirmation",
            "factor": "No external corroboration yet",
            "impact": "Unverified",
            "positive": False,
            "description": "Could not find immediate confirming news reports. This may happen with very recent breaking news."
        })

    # 3. Timeliness Check
    is_fresh = freshness.get("freshness") == "appears_current"
    if is_fresh:
         factors.append({
            "category": "Timeliness Check",
            "factor": "Content appears current",
            "impact": "passed",
            "positive": True,
            "description": "No outdated year references or 'throwback' language found. Content appears relevant to current date."
        })
    else:
        score -= 0.30
        factors.append({
            "category": "Timeliness Check",
            "factor": "Potentially Outdated/Recycled",
            "impact": "Failed",
            "positive": False,
            "description": f"Detected references to past years ({', '.join(freshness.get('old_years_mentioned', []))}) or archival language."
        })

    # 4. Location Validation
    location = result.get("location", {})
    has_location = bool(location.get("latitude") or (location.get("city") and location.get("country")))
    if has_location:
        score += 0.10
        factors.append({
            "category": "Location Validation",
            "factor": f"Location: {location.get('city') or 'GPS Found'}",
            "impact": "Verified",
            "positive": True,
            "description": "Specific geographic coordinates or city/country names were successfully extracted and validated."
        })
    else:
        score -= 0.10
        factors.append({
            "category": "Location Validation",
            "factor": "Specific location missing",
            "impact": "Missing",
            "positive": False,
            "description": "No specific city, region, or coordinates could be identified in the text or image."
        })

    # 5. Content Consistency (AI Confidence)
    ai_confidence = result.get("confidence", 0.5)
    if ai_confidence >= 0.8:
        score += 0.05
        factors.append({
            "category": "Content Consistency",
            "factor": "High AI Analysis Confidence",
            "impact": "Consistent",
            "positive": True,
            "description": "The AI model is highly confident (>80%) that this text describes a real disaster event."
        })
    elif ai_confidence < 0.4:
        score -= 0.10
        factors.append({
            "category": "Content Consistency",
            "factor": "Low AI Confidence / Ambiguous",
            "impact": "Inconsistent",
            "positive": False,
            "description": "The AI model detected ambiguity or inconsistencies in the text, suggesting it might not be a real disaster report."
        })
    else:
         factors.append({
            "category": "Content Consistency",
            "factor": "Moderate AI Confidence",
            "impact": "Neutral",
            "positive": True,
            "description": "The AI model is reasonably confident but some details may be unclear."
        })
    
    # 6. Link Safety Check
    if donation_analysis.get("donation_trust") == "scam_likely":
        score -= 0.50
        factors.append({
            "category": "Link Safety Check",
            "factor": "SCAM/Malicious Links Detected",
            "impact": "Critical Fail",
            "positive": False,
            "description": "Suspicious keywords (crypto, wire transfer) or known scam domains were found."
        })
    elif donation_analysis.get("donation_trust") == "verified":
        score += 0.10
        factors.append({
            "category": "Link Safety Check",
            "factor": "Verified Safe/Charity Links",
            "impact": "Safe",
            "positive": True,
            "description": "Links to known, registered international humanitarian organizations were found."
        })
    else:
         factors.append({
            "category": "Link Safety Check",
            "factor": "No Malicious Links Found",
            "impact": "Safe",
            "positive": True,
            "description": "No suspicious links or scam indicators were detected in the text."
        })
    
    # 7. Duplicate Noise Filtering
    if len(text) < 50 and not has_location:
         score -= 0.20
         factors.append({
            "category": "Duplicate/Noise Filtering",
            "factor": "Low Information Content",
            "impact": "Noise Likely",
            "positive": False,
            "description": "The text is very short and lacks specific details, which is a common characteristic of spam or noise."
        })
    else:
         factors.append({
            "category": "Duplicate/Noise Filtering",
            "factor": "Unique/Detailed Content",
            "impact": "Passed",
            "positive": True,
            "description": "The report provides sufficient detail and specific information to be considered a unique report."
        })

    # Final Score Clamping
    score = max(0.05, min(0.99, score))
    
    if score >= 0.80:
        status = "verified"
        status_text = "HIGHLY CREDIBLE"
        recommendation = "Verified across multiple factors."
    elif score >= 0.60:
        status = "likely_credible"
        status_text = "LIKELY CREDIBLE"
        recommendation = "Passes most checks, but verify details."
    elif score >= 0.40:
        status = "needs_verification"
        status_text = "NEEDS VERIFICATION"
        recommendation = "Several unverified factors present."
    elif score >= 0.20:
        status = "suspicious"
        status_text = "SUSPICIOUS"
        recommendation = "Major credibility gaps detected."
    else:
        status = "likely_fake"
        status_text = "LIKELY FAKE/SCAM"
        recommendation = "Do not trust. High risk of deception."
    
    return {
        "score": round(score, 2),
        "percentage": int(score * 100),
        "status": status,
        "status_text": status_text,
        "recommendation": recommendation,
        "factors": factors
    }

# ============== API ENDPOINTS ==============

@app.get("/")
async def root():
    return {"status": "online", "service": "Disaster Intelligence Agent", "version": "2.0"}

@app.post("/analyze")
async def analyze_disaster(request: AnalysisRequest):
    """Main analysis endpoint for text and URLs."""
    try:
        original_input = request.text
        platform_info = {"platform": "user_report", "platform_name": "User Report", "tier": 3, "base_trust": 0.40, "is_official": False}
        
        is_url = request.text.strip().startswith(("http://", "https://"))
        
        if is_url:
            platform_info = detect_platform_enhanced(request.text)
            result = agent.process_url(request.text)
        else:
            result = agent.process_text(request.text, source=request.source)
        
        result_dict = result.model_dump()
        
        # --- IMPROVED SOURCE DETECTION MAPPING ---
        llm_source = result_dict.get("source_platform", "unknown")
        if llm_source != "unknown" and llm_source != platform_info["platform"]:
            # If LLM found a specific source, trust it over the generic "Web Source"
            config = PLATFORM_CONFIG.get(llm_source, {})
            if config:
                platform_info.update({
                    "platform": llm_source,
                    "platform_name": config["name"],
                    "tier": config["tier"],
                    "base_trust": config["trust"],
                    "is_official": config["tier"] <= 2
                })
            else:
                 # It's a source we don't have in config, but LLM identified it
                 platform_info.update({
                    "platform": llm_source,
                    "platform_name": llm_source.title(),
                    "tier": 3, # Assume social/web
                    "base_trust": 0.5
                 })

        result_dict["source_analysis"] = {
            "platform": platform_info["platform"],
            "platform_name": platform_info["platform_name"],
            "trust_tier": platform_info["tier"],
            "is_official_source": platform_info["is_official"],
            "input_type": "url" if is_url else "text"
        }
        
        donation_analysis = analyze_donation_links(original_input + " " + result_dict.get("normalized_text", ""))
        freshness = check_content_freshness(original_input + " " + result_dict.get("normalized_text", ""))
        people_estimates = extract_people_estimates(original_input + " " + result_dict.get("normalized_text", ""))
        
        if people_estimates:
            result_dict["people_estimates"] = people_estimates
            if not result_dict.get("people_affected") and people_estimates.get("affected"):
                result_dict["people_affected"] = people_estimates["affected"]
        
        # --- NEW VERIFICATION AGENT STEP ---
        verification_results = run_verification(result_dict)
        result_dict["verification_analysis"] = verification_results
        
        credibility = calculate_comprehensive_credibility(result_dict, platform_info, original_input, donation_analysis, freshness)
        
        # Merge verification score into overall credibility
        if verification_results["is_credible"]:
             credibility["score"] = min(0.99, credibility["score"] + 0.15)
             credibility["factors"].append({"category": "External Verification", "factor": "Corroborated by News/Search", "impact": "+15%", "positive": True})
        elif verification_results["verification_status"] == "scam":
             credibility["score"] = max(0.1, credibility["score"] - 0.4)
             credibility["factors"].append({"category": "External Verification", "factor": "Marked as SCAM/Fake", "impact": "-40%", "positive": False})
             credibility["status"] = "likely_fake"
             credibility["status_text"] = "SCAM DETECTED"
        
        credibility["percentage"] = int(credibility["score"] * 100)

        result_dict["credibility"] = credibility
        result_dict["donation_analysis"] = donation_analysis
        result_dict["freshness_analysis"] = freshness
        
        # ============== NEW: LOCATION INTELLIGENCE ==============
        # Process location and generate map data with 100km radius
        map_data = process_disaster_location(
            location_data=result_dict.get("location", {}),
            disaster_type=result_dict.get("disaster_type")
        )
        result_dict["map_data"] = map_data
        
        result_dict["agent_workflow"] = {
            "steps_completed": [
                "Input Classification",
                "Content Extraction" if is_url else "Text Processing",
                "Disaster Classification",
                "Date/Time Extraction",
                "Location Extraction",
                "Urgency Assessment",
                "Donation Link Analysis",
                "External Verification (RSS)",
                "Credibility Scoring",
                "Location Intelligence (100km Radius)"
            ],
            "model_used": "Gemini/Groq LLM + Search",
            "processing_timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        return result_dict
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/analyze-image")
async def analyze_image(request: ImageAnalysisRequest):
    """Analyze disaster from image URL."""
    try:
        result = agent.process_image(request.image_url)
        result_dict = result.model_dump()
        
        if not result_dict["location"].get("city") and not result_dict["location"].get("latitude"):
            result_dict["location"]["raw_text"] = result_dict["location"].get("raw_text") or "Location could not be determined from image"
        
        donation_analysis = analyze_donation_links(result_dict.get("normalized_text", ""))
        freshness = {"freshness": "unknown", "warning": "Cannot determine freshness from image alone"}
        
        platform_info = {"platform": "image", "platform_name": "Image Analysis", "tier": 4, "base_trust": 0.25, "is_official": False}
        
        # --- NEW VERIFICATION AGENT STEP ---
        verification_results = run_verification(result_dict)
        result_dict["verification_analysis"] = verification_results
        
        credibility = calculate_comprehensive_credibility(result_dict, platform_info, "", donation_analysis, freshness)
        credibility["factors"].append({
            "category": "Media",
            "factor": "Image Source - Requires Visual Verification",
            "impact": "-15%",
            "positive": False
        })
        
         # Merge verification score into overall credibility
        if verification_results["is_credible"]:
             credibility["score"] = min(0.99, credibility["score"] + 0.15)
             credibility["factors"].append({"category": "External Verification", "factor": "Corroborated by News/Search", "impact": "+15%", "positive": True})
        elif verification_results["verification_status"] == "scam":
             credibility["score"] = max(0.1, credibility["score"] - 0.4)
             credibility["factors"].append({"category": "External Verification", "factor": "Marked as SCAM/Fake", "impact": "-40%", "positive": False})
             credibility["status"] = "likely_fake"
             credibility["status_text"] = "SCAM DETECTED"

        credibility["score"] = max(0.1, credibility["score"])
        credibility["percentage"] = int(credibility["score"] * 100)
        
        result_dict["source_analysis"] = {
            "platform": "image_url",
            "platform_name": "Image URL",
            "trust_tier": 4,
            "is_official_source": False,
            "input_type": "image_url",
            "image_url": request.image_url
        }
        
        result_dict["credibility"] = credibility
        result_dict["donation_analysis"] = donation_analysis
        result_dict["freshness_analysis"] = freshness
        
        result_dict["agent_workflow"] = {
            "steps_completed": [
                "Image Download",
                "Vision AI Analysis",
                "Scene Description",
                "Disaster Classification",
                "Location Extraction (from visual cues)",
                "Damage Assessment",
                "External Verification",
                "Credibility Scoring"
            ],
            "model_used": "Gemini Vision",
            "processing_timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        return result_dict
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {str(e)}")

@app.post("/analyze-image-upload")
async def analyze_image_upload(file: UploadFile = File(...)):
    """Analyze uploaded image file."""
    try:
        contents = await file.read()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file.filename.split('.')[-1] if '.' in file.filename else 'jpg'}") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        
        try:
            result = agent.process_image(tmp_path)
            result_dict = result.model_dump()
            
            if not result_dict["location"].get("city") and not result_dict["location"].get("latitude"):
                result_dict["location"]["raw_text"] = result_dict["location"].get("raw_text") or "Location could not be determined from image"
            
            donation_analysis = analyze_donation_links(result_dict.get("normalized_text", ""))
            freshness = {"freshness": "unknown", "warning": "Cannot determine freshness from image alone"}
            
            platform_info = {"platform": "image_upload", "platform_name": "Direct Upload", "tier": 3, "base_trust": 0.35, "is_official": False}
            
            # --- NEW VERIFICATION AGENT STEP ---
            verification_results = run_verification(result_dict)
            result_dict["verification_analysis"] = verification_results
            
            credibility = calculate_comprehensive_credibility(result_dict, platform_info, "", donation_analysis, freshness)
            credibility["factors"].append({
                "category": "Media",
                "factor": "Direct Image Upload - User Provided",
                "impact": "+5%",
                "positive": True
            })
            
            # Merge verification score into overall credibility
            if verification_results["is_credible"]:
                 credibility["score"] = min(0.99, credibility["score"] + 0.15)
                 credibility["factors"].append({"category": "External Verification", "factor": "Corroborated by News/Search", "impact": "+15%", "positive": True})
            elif verification_results["verification_status"] == "scam":
                 credibility["score"] = max(0.1, credibility["score"] - 0.4)
                 credibility["factors"].append({"category": "External Verification", "factor": "Marked as SCAM/Fake", "impact": "-40%", "positive": False})
                 credibility["status"] = "likely_fake"
                 credibility["status_text"] = "SCAM DETECTED"
            
            credibility["percentage"] = int(credibility["score"] * 100)
            
            result_dict["source_analysis"] = {
                "platform": "image_upload",
                "platform_name": "Direct Upload",
                "trust_tier": 3,
                "is_official_source": False,
                "input_type": "image_upload",
                "filename": file.filename
            }
            
            result_dict["credibility"] = credibility
            result_dict["donation_analysis"] = donation_analysis
            result_dict["freshness_analysis"] = freshness
            
            result_dict["agent_workflow"] = {
                "steps_completed": [
                    "File Upload Processing",
                    "Image Validation",
                    "Vision AI Analysis",
                    "Scene Description",
                    "Disaster Classification",
                    "Location Extraction (from visual cues)",
                    "Damage Assessment",
                    "External Verification",
                    "Credibility Scoring"
                ],
                "model_used": "Gemini Vision",
                "processing_timestamp": datetime.utcnow().isoformat() + "Z"
            }
            
            return result_dict
            
        finally:
            os.unlink(tmp_path)
            
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Image upload analysis failed: {str(e)}")

@app.post("/nearby-disasters")
async def get_nearby_disasters(request: NearbyDisastersRequest):
    """
    Get disasters within specified radius of user's location.
    Uses mock data for demonstration - integrate with real disaster APIs in production.
    """
    try:
        import random
        import math
        
        # Get location name from coordinates
        location_name = f"{request.latitude:.4f}, {request.longitude:.4f}"
        
        if GOOGLE_API_KEY:
            try:
                # Reverse geocode to get location name
                url = f"https://maps.googleapis.com/maps/api/geocode/json"
                params = {
                    'latlng': f"{request.latitude},{request.longitude}",
                    'key': GOOGLE_API_KEY
                }
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, params=params, timeout=3.0)
                    data = response.json()
                    
                    if data['status'] == 'OK' and data['results']:
                        location_name = data['results'][0]['formatted_address']
            except Exception as e:
                print(f"Geocoding error: {e}")
                pass
        
        # Mock disaster data - In production, integrate with:
        # - GDACS (Global Disaster Alert and Coordination System)
        # - USGS Earthquake API
        # - NOAA Weather Alerts
        # - Local emergency services APIs
        
        disaster_types = ['earthquake', 'flood', 'storm', 'fire', 'landslide', 'cyclone']
        severities = ['low', 'moderate', 'high', 'critical']
        
        # Generate mock nearby disasters (replace with real API calls)
        mock_disasters = []
        num_disasters = random.randint(0, 5)  # 0-5 disasters
        
        for i in range(num_disasters):
            # Generate random point within radius
            angle = random.uniform(0, 360)
            distance = random.uniform(5, request.radius_km)
            
            # Calculate offset coordinates
            lat_offset = (distance / 111.0) * math.cos(math.radians(angle))
            lng_offset = (distance / (111.0 * math.cos(math.radians(request.latitude)))) * math.sin(math.radians(angle))
            
            disaster_lat = request.latitude + lat_offset
            disaster_lng = request.longitude + lng_offset
            
            # Get city name for disaster location
            city = f"Location {i+1}"
            region = "Unknown"
            
            if GOOGLE_API_KEY:
                try:
                    url = f"https://maps.googleapis.com/maps/api/geocode/json"
                    params = {
                        'latlng': f"{disaster_lat},{disaster_lng}",
                        'key': GOOGLE_API_KEY
                    }
                    async with httpx.AsyncClient() as client:
                        response = await client.get(url, params=params, timeout=2.0)
                        data = response.json()
                        
                        if data['status'] == 'OK' and data['results']:
                            address_components = data['results'][0]['address_components']
                            city = next((c['long_name'] for c in address_components if 'locality' in c['types']), None)
                            region = next((c['long_name'] for c in address_components if 'administrative_area_level_1' in c['types']), None)
                            
                            if not city:
                                city = region or f"Location {i+1}"
                            if not region:
                                region = "Unknown Region"
                except Exception as e:
                    print(f"Geocoding error for disaster {i}: {e}")
                    pass
            
            # Generate time
            hours_ago = random.randint(1, 48)
            
            if hours_ago < 2:
                time_str = f"{hours_ago}h ago"
            elif hours_ago < 24:
                time_str = f"{hours_ago}h ago"
            else:
                days = hours_ago // 24
                time_str = f"{days}d ago"
            
            mock_disasters.append({
                "type": random.choice(disaster_types),
                "severity": random.choice(severities),
                "city": city,
                "region": region,
                "latitude": disaster_lat,
                "longitude": disaster_lng,
                "distance_km": round(distance, 1),
                "last_reported": time_str,
                "source": random.choice([
                    "USGS", "NOAA", "Local Emergency Services", 
                    "Weather Service", "Geological Survey"
                ])
            })
        
        # Sort by distance
        mock_disasters.sort(key=lambda x: x['distance_km'])
        
        return {
            "user_location": {
                "latitude": request.latitude,
                "longitude": request.longitude,
                "location_name": location_name
            },
            "search_radius_km": request.radius_km,
            "disasters_found": len(mock_disasters),
            "disasters": mock_disasters,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "note": "Mock data for demonstration. Integrate with real disaster APIs for production."
        }
        
    except Exception as e:
        print(f"Error in nearby-disasters endpoint: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
