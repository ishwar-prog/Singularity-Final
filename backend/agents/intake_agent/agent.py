"""Agent 1: Disaster Intake & Normalization Agent"""
import json
from datetime import datetime
import os
from typing import Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.runnables import RunnableLambda
import httpx
import httpx
import re
from dotenv import load_dotenv
from .schema import DisasterIntakeRequest, SCHEMA_JSON, Location

# Load environment variables
load_dotenv()

GOOGLE_MAPS_API_KEY = "AIzaSyAOVYRIgupAurZup5y1PRh8Ismb1A3lLao"

def geocode_location(location_name: str) -> dict:
    """Geocode a location name using Google Maps API."""
    if not location_name or location_name.lower() in ["unknown", "somewhere"]:
        return {}
        
    try:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": location_name, "key": GOOGLE_MAPS_API_KEY}
        response = httpx.get(url, params=params, timeout=5)
        data = response.json()
        
        if data.get("status") == "OK" and data.get("results"):
            result = data["results"][0]
            loc = result["geometry"]["location"]
            
            # Extract city/country from address components
            city = None
            country = None
            region = None
            
            for comp in result.get("address_components", []):
                types = comp.get("types", [])
                if "locality" in types:
                    city = comp["long_name"]
                elif "administrative_area_level_1" in types:
                    region = comp["long_name"]
                elif "country" in types:
                    country = comp["long_name"]
            
            return {
                "raw_text": location_name,
                "city": city or location_name,
                "region": region,
                "country": country,
                "latitude": loc["lat"],
                "longitude": loc["lng"]
            }
    except Exception as e:
        print(f"Geocoding error: {e}")
        
    return {"raw_text": location_name}

class MockChatModel:
    """Mock Chat Model as a Runnable."""
    def invoke(self, input_data: any, config: Optional[dict] = None, **kwargs) -> any:
        from langchain_core.messages import AIMessage
        import json
        
        # Extract text from input if it's a dict or prompt value
        input_str = str(input_data)
        input_lower = input_str.lower()
        
        # Enhanced keyword matching for disaster types
        disaster_type = "unknown"
        if any(w in input_lower for w in ["quake", "shake", "temblor", "seismic", "magnitude", "rolling"]):
            disaster_type = "earthquake"
        elif any(w in input_lower for w in ["flood", "drowning", "inundated", "overflow", "flash flood"]):
            disaster_type = "flood"
        # Only check "water" if it's not "need water"
        elif "water" in input_lower and not any(phrase in input_lower for phrase in ["need water", "send water", "drinking water", "no water"]):
            disaster_type = "flood"
        elif any(w in input_lower for w in ["fire", "wildfire", "burning", "blaze", "smoke", "flames"]):
            disaster_type = "wildfire"
        elif any(w in input_lower for w in ["hurricane", "storm", "cyclone", "typhoon", "wind", "tornado"]):
            disaster_type = "hurricane"
        elif any(w in input_lower for w in ["accident", "crash", "collision"]):
            disaster_type = "other"
            
        # Extract potential location name using regex (heuristic)
        location_data = {
            "raw_text": "Unknown Location",
            "city": None,
            "country": None,
            "latitude": None, 
            "longitude": None
        }
        
        # Look for "in [City]" or "at [Location]" - Case Insensitive
        # Captures: "in Paris", "near Tokyo", "from New York"
        loc_match = re.search(r'\b(in|at|near|from)\s+([a-zA-Z\s]+?)(?=\s*(?:,|\.|!|$|and|with|causing))', input_str, re.IGNORECASE)
        if loc_match:
            extracted_loc = loc_match.group(2).strip()
            # Filter out common stopwords that might be matched
            stopwords = ["the", "my", "a", "an", "here", "there", "his", "her", "their", "our", "danger", "heavy"]
            if extracted_loc.lower() not in stopwords and len(extracted_loc) > 2:
                geocoded = geocode_location(extracted_loc)
                if geocoded:
                    location_data = geocoded

        # Determine urgency
        urgency = "medium"
        if any(w in input_lower for w in ["help", "trapped", "emergency", "dying", "blood", "critical", "urgent", "rescue"]):
            urgency = "critical"
        elif any(w in input_lower for w in ["need", "shortage", "missing"]):
            urgency = "high"
        elif "inform" in input_lower or "update" in input_lower:
            urgency = "low"

        # Determine need type
        need_type = "unknown"
        if any(w in input_lower for w in ["food", "hungry", "starvation", "eat"]):
            need_type = "food"
        elif any(w in input_lower for w in ["water", "thirsty", "drink"]):
            need_type = "water"
        elif any(w in input_lower for w in ["doctor", "medic", "hospital", "injured", "hurt", "bleeding"]):
            need_type = "medical"
        elif any(w in input_lower for w in ["trap", "stuck", "rescue", "save"]):
            need_type = "rescue"
        elif any(w in input_lower for w in ["shelter", "house", "home", "roof"]):
            need_type = "shelter"
            
        mock_response = {
            "request_id": "mock-generated-id",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "source_platform": "web",
            "source_language": "en",
            "original_text": input_str,
            "normalized_text": f"[MOCK ANALYSIS] Identified {disaster_type.upper()} event with {urgency.upper()} urgency. {f'Location located: {location_data.get('city')}' if location_data.get('city') else 'Location unknown.'}",
            "disaster_type": disaster_type,
            "need_type": need_type if need_type != "unknown" else "information",
            "urgency": urgency,
            "people_affected": 50 if urgency == "critical" else 10,
            "vulnerable_groups": ["children", "elderly"] if urgency == "critical" else [],
            "location": location_data,
            "confidence": 0.9 if location_data.get("latitude") else 0.6,
            "contact_info": "911" if urgency == "critical" else None,
            "flags": ["mock_mode_enhanced", "google_maps_geocoded" if location_data.get("latitude") else "location_heuristic"]
        }
        
        return AIMessage(content=json.dumps(mock_response))

    # Add required Runnable methods (minimal)
    def stream(self, input, config=None, **kwargs):
        yield self.invoke(input, config, **kwargs)
        
    def batch(self, inputs, config=None, **kwargs):
        return [self.invoke(i, config, **kwargs) for i in inputs]

def get_llm(provider: str = "auto", model: str = None, temperature: float = 0.0):
    """Get LLM - auto-detects available free provider."""
    
    if provider == "auto":
        if os.getenv("GROQ_API_KEY"):
            provider = "groq"
        elif os.getenv("GOOGLE_API_KEY"):
            provider = "google"
        elif os.getenv("OPENAI_API_KEY"):
            provider = "openai"
        else:
            provider = "mock"  # Fallback to internal mock if no keys
    
    if provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(model=model or "llama-3.3-70b-versatile", temperature=temperature)
    
    elif provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model=model or "gemini-1.5-flash", temperature=temperature)
    
    elif provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(model=model or "llama3.1", temperature=temperature, format="json")
    
    elif provider == "mock":
        mock_model = MockChatModel()
        return RunnableLambda(mock_model.invoke)
    
    else:  # openai
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model or "gpt-4o-mini",
            temperature=temperature,
            model_kwargs={"response_format": {"type": "json_object"}}
        )



SYSTEM_PROMPT = """You are Agent 1: Disaster Intake & Normalization Agent.

Your ONLY task is to convert raw disaster-related input text into a STRICT JSON object.

Rules:
1. Output valid JSON ONLY - no explanations, no markdown.
2. DO NOT invent or hallucinate missing data.
3. If data is missing, use null, "unknown", or best classification with LOW confidence.
4. Detect input language, translate to English internally before processing.
5. Infer urgency conservatively. When human safety is implied, prefer higher urgency.
6. If input is irrelevant/spam, set need_type = "unknown" and confidence < 0.3.
7. **TIMESTAMP EXTRACTION**: Extract the specific date/time mentioned in the text/image description (e.g. "happened yesterday", "on Jan 12th"). If NO date is mentioned, return "unknown". DO NOT use the current system time.
8. **SOURCE EXTRACTION**: If the text mentions a source (e.g. "via BBC", "from Twitter user @xyz"), update 'source_platform' and 'contact_info' accordingly.

Urgency Mapping:
- critical: trapped, bleeding, life-threatening, children/elderly in danger
- high: no food/water, medical need, stranded
- medium: assistance requested without danger
- low: informational or future need

Schema:
{schema}

Return ONLY the JSON object matching this schema exactly."""

class DisasterIntakeAgent:
    def __init__(self, provider: str = "auto", model: str = None, temperature: float = 0.0):
        self.llm = get_llm(provider, model, temperature)
        self.parser = JsonOutputParser(pydantic_object=DisasterIntakeRequest)
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            ("human", "Process this disaster report:\n\n{input_text}\n\nSource platform: {source_platform}")
        ])
        self.chain = self.prompt | self.llm | self.parser

    def process(self, input_text: str, source_platform: str = "unknown") -> DisasterIntakeRequest:
        """Process raw disaster text into normalized schema."""
        result = self.chain.invoke({
            "input_text": input_text,
            "source_platform": source_platform,
            "schema": json.dumps(SCHEMA_JSON, indent=2)
        })
        
        # Remove None values for auto-generated fields (let Pydantic defaults handle them)
        if result.get("request_id") in [None, "unknown"]:
            result.pop("request_id", None)
        if result.get("timestamp") in [None, "unknown"]:
            result.pop("timestamp", None)
        
        if result.get("timestamp") in [None, "unknown"]:
            result.pop("timestamp", None)
            
        # --- GEOCODING ENHANCEMENT FOR REAL LLMS ---
        # If LLM returned a city name but no lat/long, force geocoding
        start_location = result.get("location", {}) or {}
        
        # Check if we have a city/text but missing coordinates
        has_text = bool(start_location.get("raw_text") or start_location.get("city"))
        missing_coords = not (start_location.get("latitude") and start_location.get("longitude"))
        
        if has_text and missing_coords:
            # Try to grab the best text string to search
            search_query = start_location.get("city") or start_location.get("raw_text")
            if search_query:
                geocoded = geocode_location(search_query)
                if geocoded:
                    # Merge geocoded data into the location dict
                    start_location.update(geocoded)
                    result["location"] = start_location
                    result["flags"] = result.get("flags", []) + ["post_process_geocoded"]
        
        # Validate and create Pydantic model
        return DisasterIntakeRequest(**result)

    def process_batch(self, inputs: list[dict]) -> list[DisasterIntakeRequest]:
        """Process multiple inputs."""
        return [self.process(i["text"], i.get("source", "unknown")) for i in inputs]


# Standalone function for quick use
def normalize_disaster_report(
    text: str, 
    source: str = "unknown",
    provider: str = "auto"
) -> dict:
    """Quick function to normalize a disaster report."""
    agent = DisasterIntakeAgent(provider=provider)
    result = agent.process(text, source)
    return result.model_dump()


if __name__ == "__main__":
    # Test example
    test_input = """
    HELP! We are trapped on the roof at 123 Main Street, Springfield. 
    Water rising fast. 3 adults, 2 children, one elderly woman with heart condition.
    Phone dying. Please send rescue boats ASAP!
    """
    
    agent = DisasterIntakeAgent()  # Auto-detects free provider
    result = agent.process(test_input, "twitter")
    print(json.dumps(result.model_dump(), indent=2))
