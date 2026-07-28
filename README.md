# EventPlanner (CareerFair)

Malaysia career-fair calendar: browse upcoming events, manage them in an admin console, and use AI for chat, descriptions, and natural-language scheduling.

```text
EventPlanner/
├── frontend/     # TanStack Start + React UI
└── backend/      # FastAPI API + SQLite
```

## Features

- Public calendar and event discovery (Malaysia universities / career fairs)
- Admin auth (JWT), event CRUD, conflict checks, duplicate, soft-delete
- Dashboard stats and audit log
- AI assistant: event Q&A chat, description generation, NL cancel/reschedule plans, analytics insights
- Optional seed from Talentbank’s public events API

## Prerequisites

- Node.js 20+ and pnpm (or npm)
- Python 3.11+
- Optional AI backends:
  - **Gemini** — set `GEMINI_API_KEY` (preferred when set)
  - **Ollama** — local models at `http://localhost:11434` (used when Gemini is unset, or as fallback if Gemini fails)

Without an LLM, AI endpoints still return heuristic fallbacks where implemented.

## Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # or: cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs  
- Health: http://localhost:8000/health  

### Environment (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | JWT signing secret |
| `DATABASE_URL` | Default `sqlite:///./careerfair.db` |
| `CORS_ORIGINS` | Comma-separated origins (e.g. Vite ports) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime (default 7 days) |
| `GEMINI_API_KEY` | Prefer Gemini when set; leave empty for Ollama only |
| `GEMINI_MODEL` | Default `gemini-2.0-flash` |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | Local LLM (default `llama3.1`) |

### Seed sample events

With the venv active and deps installed:

```bash
cd backend
python -m scripts.seed_talentbank
```

Pulls public events from Talentbank into the local SQLite DB.

## Frontend

```bash
cd frontend
pnpm install   # or: npm install
copy .env.example .env   # VITE_API_BASE_URL=http://localhost:8000
pnpm dev       # or: npm run dev
```

App typically runs at http://localhost:5173 (or the port Vite prints).

Without `VITE_API_BASE_URL`, the UI uses a localStorage mock so it still works offline.

### Main routes

| Path | Description |
|------|-------------|
| `/` | Public calendar |
| `/chatbot` | Event Q&A chatbot |
| `/admin/login` / `/admin/signup` | Admin auth |
| `/admin` | Dashboard |
| `/admin/events` | Event management |
| `/admin/assistant` | NL command assistant |
| `/admin/analytics` | Analytics |
| `/admin/audit` | Audit log |

## First admin user

Sign up at `/admin/signup`. The first registered user becomes `superadmin`.
