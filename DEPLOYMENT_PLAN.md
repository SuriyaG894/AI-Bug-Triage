# Deployment Plan

## Architecture

```
┌─────────────┐           ┌─────────────┐
│   Vercel    │  ──────▶  │   Render    │
│  (Frontend) │           │  (Backend)  │
└─────────────┘           └─────────────┘
                                  │
                                  ▼
                          ┌─────────────┐
                          │  Supabase   │
                          │  (PostgreSQL│
                          │   +pgvector)│
                          └─────────────┘
```

---

## Prerequisites

- GitHub repository with code pushed
- Supabase account (free tier)
- Groq API key (for AI features)
- Upstash account for Redis (optional, free tier)

---

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python 3.11) + SQLAlchemy + Uvicorn |
| Database | Supabase PostgreSQL (with pgvector) |
| External | Groq AI, Azure DevOps, JIRA |

---

## Step 1: Supabase Setup

1. Create project at supabase.com
2. Enable pgvector in SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
3. Get connection string from Settings → Database → Connection string

---

## Step 2: Backend (Render)

### Option A: render.yaml (Declarative)

Create `backend/render.yaml`:

```yaml
services:
  - type: web
    name: opencode-backend
    env: python
    region: Oregon
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: SECRET_KEY
        sync: false
      - key: GROQ_API_KEY
        sync: false
      - key: CORS_ORIGINS
        sync: false
      - key: DEBUG
        value: "false"
```

### Option B: Manual Dashboard Config

1. Connect GitHub repo to Render
2. Select `backend/` as root directory
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Environment Variables

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Supabase connection string |
| `REDIS_URL` | Upstash URL or leave empty |
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `GROQ_API_KEY` | Your Groq API key |
| `CORS_ORIGINS` | Your Vercel frontend URL |
| `DEBUG` | `false` |

### Create requirements.txt

If not already present in `backend/`:

```bash
cd backend
pip freeze > requirements.txt
```

---

## Step 3: Frontend (Vercel)

### vercel.json

Create `frontend/vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Deploy

1. Import GitHub repo to Vercel
2. Select `frontend/` as root directory
3. Build command: `npm run build`
4. Output directory: `dist`

### Environment Variables

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://opencode-backend.onrender.com` |

---

## Step 4: CORS Configuration

Update `backend/app/core/config.py`:

```python
CORS_ORIGINS: list[str] = ["https://your-frontend.vercel.app"]
```

---

## Step 5: Optional - Redis (Upstash)

1. Create account at upstash.com
2. Create Redis database
3. Add `REDIS_URL` to Render environment variables

---

## Checklist

- [ ] Push code to GitHub
- [ ] Create Supabase project with pgvector
- [ ] Deploy backend to Render
- [ ] Get Render backend URL
- [ ] Deploy frontend to Vercel
- [ ] Update VITE_API_URL in Vercel
- [ ] Test deployment end-to-end

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| pgvector not available | Supabase free tier supports pgvector |
| CORS errors | Verify CORS_ORIGINS matches your Vercel URL |
| 500 errors | Check Render logs for Python errors |
| Build fails | Verify requirements.txt has all dependencies |