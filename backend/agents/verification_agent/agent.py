
import os
import json
import httpx
import re
import xml.etree.ElementTree as ET
from typing import List, Dict, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class VerificationResult(BaseModel):
    is_credible: bool
    confidence_score: float = Field(..., description="0.0 to 1.0")
    verification_status: str = Field(..., description="verified, disputed, unverified, scam")
    corroborating_sources: List[Dict[str, str]] = []
    scam_probability: float = Field(..., description="0.0 to 1.0")
    analysis_notes: str

class VerificationAgent:
    def __init__(self):
        self.scam_keywords = [
            "send crypto", "bitcoin", "wallet", "western union", "cash app", 
            "venmo", "dm for link", "urgently donate", "personal account"
        ]
        
    def search_google_news_rss(self, query: str) -> List[Dict]:
        """Search Google News RSS for corroboration (using XML parsing)."""
        encoded_query = query.replace(" ", "+")
        url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-US&gl=US&ceid=US:en"
        
        try:
            # Add User-Agent header to avoid 403
            headers = {"User-Agent": "Mozilla/5.0 (compatible; DisasterBot/1.0)"}
            response = httpx.get(url, headers=headers, timeout=10) # Reduced timeout for speed
            
            if response.status_code != 200:
                print(f"RSS Search returned status {response.status_code}")
                return []
                
            root = ET.fromstring(response.content)
            results = []
            
            # Iterate through channel/item
            for item in root.findall("./channel/item")[:5]:
                title = item.find("title").text if item.find("title") is not None else "No Title"
                link = item.find("link").text if item.find("link") is not None else ""
                pubDate = item.find("pubDate").text if item.find("pubDate") is not None else ""
                source = item.find("source").text if item.find("source") is not None else "Google News"
                
                results.append({
                    "title": title,
                    "link": link,
                    "pubDate": pubDate,
                    "source": source
                })
            return results
        except Exception as e:
            print(f"RSS Search failed: {e}")
            return []

    def verify_event(self, intake_data: dict) -> VerificationResult:
        """Verify the disaster event using search and heuristic analysis."""
        
        disaster_type = intake_data.get("disaster_type", "unknown")
        location = intake_data.get("location", {})
        city = location.get("city") or location.get("region") or location.get("raw_text", "")
        
        # 1. SCAM CHECK
        text = intake_data.get("original_text", "") + " " + intake_data.get("normalized_text", "")
        scam_score = 0.0
        scam_notes = []
        
        text_lower = text.lower()
        for kw in self.scam_keywords:
            if kw in text_lower:
                scam_score += 0.3
                scam_notes.append(f"Found suspicious term: '{kw}'")
        
        if intake_data.get("donation_analysis", {}).get("donation_trust") == "scam_likely":
            scam_score += 0.5
            scam_notes.append("Donation analysis flagged potential scam")

        # 2. EXTERNAL VERIFICATION (RSS)
        verified_sources = []
        confidence = 0.5  # Start neutral
        notes = "Analysis started. "
        
        if disaster_type != "unknown" and city and len(city) > 2:
            query = f"{disaster_type} {city}"
            news_results = self.search_google_news_rss(query)
            
            if news_results:
                confidence += 0.3
                notes += f"Found {len(news_results)} matching news reports. "
                verified_sources = news_results
            else:
                confidence -= 0.1
                notes += "No immediate news reports found via RSS. "
        else:
            notes += "Insufficient location/type data for news verification. "

        # 3. SOURCE TRUST
        source_tier = intake_data.get("source_analysis", {}).get("trust_tier", 4)
        if source_tier <= 2:
            confidence += 0.2
            notes += "Source is a trusted official/news outlet. "
        elif source_tier == 4:
            confidence -= 0.1
        
        # 4. FINAL SCORING
        confidence = max(0.0, min(1.0, confidence))
        scam_score = max(0.0, min(1.0, scam_score))
        
        if scam_score > 0.6:
            status = "scam"
            confidence = 0.1 # Low confidence in it being real
        elif confidence > 0.7:
            status = "verified"
        elif confidence > 0.4:
            status = "unverified"
        else:
            status = "disputed"

        return VerificationResult(
            is_credible=(confidence > 0.6 and scam_score < 0.4),
            confidence_score=confidence,
            verification_status=status,
            corroborating_sources=verified_sources,
            scam_probability=scam_score,
            analysis_notes=notes + (" | Scam warnings: " + ", ".join(scam_notes) if scam_notes else "")
        )

# Helper function
def run_verification(intake_json: dict) -> dict:
    agent = VerificationAgent()
    result = agent.verify_event(intake_json)
    return result.model_dump()
