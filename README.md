# EventPlanner (CareerFair)

Malaysia career-fair calendar: React frontend + FastAPI backend.

```text
EventPlanner/
├── frontend/     # TanStack Start + React UI
└── backend/      # FastAPI API + SQLite
```

## Prerequisites

- Node.js 20+ and pnpm/npm
- Python 3.11+

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

API docs: http://localhost:8000/docs

## Frontend

```bash
cd frontend
pnpm install   # or: npm install
copy .env.example .env   # sets VITE_API_BASE_URL=http://localhost:8000
pnpm dev       # or: npm run dev
```

Without `VITE_API_BASE_URL`, the UI uses a localStorage mock so it still works offline.

## First admin user

Sign up at `/admin/signup`. The first registered user becomes `superadmin`.
