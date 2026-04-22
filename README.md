# AI Bug Triage & Root Cause Analyzer

An intelligent system that automates the bug triage process by analyzing defect reports using AI.

## Features

- Automated Bug Classification (severity & type)
- Duplicate Bug Detection using semantic similarity
- Root Cause Suggestion
- Integration with Azure DevOps and JIRA
- Analytics Dashboard

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Python + FastAPI + SQLAlchemy
- **Database:** PostgreSQL + pgvector
- **AI:** Groq API
- **Cache:** Redis

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Groq API Key

### Setup

1. Clone the repository
2. Copy environment files:
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. Add your Groq API key to `.env`:
   ```
   GROQ_API_KEY=your-api-key-here
   ```

4. Start the services:
   ```bash
   docker-compose up -d
   ```

5. Access the application:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/bugs | List all bugs |
| POST | /api/bugs | Create a new bug |
| GET | /api/bugs/{id} | Get bug details |
| PUT | /api/bugs/{id} | Update bug |
| DELETE | /api/bugs/{id} | Delete bug |
| POST | /api/bugs/check-duplicate | Check for duplicates |
| GET | /api/analytics/summary | Get analytics summary |
| GET | /api/integrations | List integrations |
| POST | /api/integrations | Create integration |

## License

MIT
