# Disaster Relief Resource Scout

AI-powered disaster relief intelligence system with real-time disaster analysis, verification, and location-based alerts.

## Features

- 🔍 **Disaster Analysis**: Analyze text, URLs, and images for disaster information
- ✅ **Verification**: Multi-source verification of disaster reports
- 📍 **Location Intelligence**: Geocoding and nearby disaster detection
- 🗺️ **Interactive Maps**: Visualize disaster locations
- ⚡ **Real-time Alerts**: Get alerts for disasters near your location

## Quick Start (Local Development)

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Add your API keys
python api.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🚀 Deploy to Render

### Option 1: Blueprint Deployment (Recommended)

1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click **New** → **Blueprint**
4. Connect your GitHub repo
5. Render will auto-detect `render.yaml` and create both services
6. Add environment variables in Render dashboard

### Option 2: Manual Deployment

#### Deploy Backend (Web Service)

1. Go to Render Dashboard → **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Name**: `disaster-relief-api`
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn api:app --host 0.0.0.0 --port $PORT`
4. Add Environment Variables:
   - `GOOGLE_API_KEY`
   - `GROQ_API_KEY` or `OPENAI_API_KEY`
5. Click **Create Web Service**

#### Deploy Frontend (Static Site)

1. Go to Render Dashboard → **New** → **Static Site**
2. Connect the same GitHub repo
3. Configure:
   - **Name**: `disaster-relief-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add Environment Variable:
   - `VITE_API_URL`: `https://disaster-relief-api.onrender.com` (your backend URL)
5. Add Rewrite Rule:
   - Source: `/*`
   - Destination: `/index.html`
   - Action: Rewrite
6. Click **Create Static Site**

### Environment Variables

#### Backend (Required)
| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` | Google Maps/Geocoding API key |
| `GROQ_API_KEY` | Groq API key for LLM |
| `OPENAI_API_KEY` | OpenAI API key (alternative to Groq) |

#### Frontend (Required for Production)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Full URL of your deployed backend |

---

## Agent 1: Disaster Intake & Normalization Agent

Production-ready agent that converts raw disaster reports into structured JSON.

### Quick Start

```bash
pip install -r requirements.txt
export OPENAI_API_KEY=sk-your-key
python test_intake.py
```

### Usage

```python
from agents.intake_agent import DisasterIntakeAgent, normalize_disaster_report

# Quick function
result = normalize_disaster_report("HELP! Trapped on roof!", source="twitter")

# Agent class
agent = DisasterIntakeAgent(model="gpt-4o-mini")
result = agent.process(raw_text, source_platform="whatsapp")

# LangGraph node (multi-agent orchestration)
from agents.intake_agent.langgraph_node import create_intake_graph
graph = create_intake_graph()
result = graph.invoke({"raw_input": text, "source_platform": "sms"})
```

### Output Schema

| Field | Type | Description |
|-------|------|-------------|
| request_id | UUID | Auto-generated |
| timestamp | ISO-8601 | Auto-generated |
| disaster_type | enum | earthquake, flood, hurricane, etc |
| need_type | enum | medical, food, rescue, etc |
| urgency | enum | critical, high, medium, low |
| location | object | Parsed location data |
| confidence | float | 0.0-1.0 classification confidence |

---

# Singularity-Hackathon