# AIBugTriage - End-to-End Support Guide

## 1. Application Overview
AIBugTriage is an intelligent system that automates the bug triage process by analyzing defect reports using AI. It integrates with existing issue tracking systems like Azure DevOps and JIRA, automatically categorizes bugs by severity and type, detects duplicates using semantic similarity, and suggests root causes.

## 2. Architecture & Tech Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Recharts
- **Backend:** Python FastAPI, SQLAlchemy, Uvicorn
- **Database:** PostgreSQL (with `pgvector` extension)
- **AI/ML:** Groq API (llama-3.1-8b-instant), fastembed (all-MiniLM-L6-v2)
- **Integrations:** Azure DevOps REST API, JIRA REST API
- **Infrastructure:** Docker Compose, Redis (Optional), Vercel (Frontend), Render (Backend), Supabase (Database)

## 3. Core Features
- **User Authentication:** JWT-based auth, password reset via OTP, Role-based access control (Admin/User).
- **AI-Powered Bug Analysis:**
  - Auto-classification of severity and type.
  - Root cause analysis suggestion with confidence scores.
- **Duplicate Detection:** 
  - Semantic matching using `pgvector` embeddings.
  - Text-based Jaccard similarity fallback.
  - External issue cache for Azure DevOps integration.
- **Integrations:** Two-way sync with Azure DevOps (ADO) and basic JIRA support. Supports pushing bugs, syncing statuses, and deduplicating.
- **Analytics:** Dashboard showing total bugs, open vs resolved, severity distribution, and trends.
- **Audit Logging:** Comprehensive tracking of user actions (login, bug creation, edits, integrations, etc.).

## 4. Environment & Deployment Setup
For a full deployment guide, refer to the [Deployment Plan](../DEPLOYMENT_PLAN.md).

### Prerequisites
- Docker & Docker Compose (for local deployment)
- Groq API Key
- PostgreSQL Database with `pgvector` enabled (e.g., Supabase free tier)

### Local Environment Quick Start
1. Copy environment files:
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
2. Add your Groq API key to the backend `.env`.
3. Start the services: 
   ```bash
   docker-compose up -d
   ```
4. Access the application:
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:8000/docs`

## 5. Troubleshooting & Common Issues

### 5.1 AI Analysis Fails or Returns Defaults
- **Symptom:** AI suggests "medium" severity and "general" type continuously with 0.5 confidence.
- **Cause:** Groq API key is missing, invalid, or rate-limited.
- **Resolution:** Verify `GROQ_API_KEY` in the backend environment variables. Restart backend services if deploying locally.

### 5.2 Duplicate Detection is Inaccurate
- **Symptom:** Obvious duplicates are missed, or completely unrelated bugs are flagged.
- **Cause:** The embedding service might have failed to initialize, or the `pgvector` extension is missing.
- **Resolution:** Check backend logs for `fastembed` model download errors. Ensure `pgvector` extension is active in PostgreSQL by running:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```

### 5.3 Azure DevOps Sync Failing
- **Symptom:** Bugs are not pushed to ADO, or the manual sync returns 401/403 errors.
- **Cause:** Invalid Personal Access Token (PAT), or incorrect Organization/Project configuration.
- **Resolution:** 
  - Navigate to **Admin Panel > Integrations** in the frontend.
  - Edit the ADO integration and verify the Organization URL and Project name.
  - Generate a new PAT in ADO with "Work Items (Read & Write)" access and update the integration credentials.

### 5.4 Database Migrations / Sync State Errors
- **Symptom:** Errors stating tables/columns are missing or sync state conflicts occur.
- **Resolution:** Ensure the database schema is up-to-date by running Alembic migrations:
  ```bash
  cd backend
  alembic upgrade head
  ```

### 5.5 Authentication & OTP Emails Not Sending
- **Symptom:** Users cannot receive password reset OTPs.
- **Cause:** SMTP configuration is missing or invalid.
- **Resolution:** Check backend `.env` variables for `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASSWORD` (e.g., Mailtrap for testing, SendGrid/AWS SES for production).

## 6. Support & Escalation Path
If the steps in the Troubleshooting guide do not resolve the issue:
1. **Level 1 (Basic Support):** Check application logs via Docker (`docker-compose logs -f backend`) or your hosting provider's dashboard (Render/Vercel).
2. **Level 2 (Database/Admin):** Check the **Admin Panel > Audit Logs** in the web interface to trace user actions preceding the issue.
3. **Level 3 (Developer Escalation):** Gather the following and escalate to the engineering team:
   - Backend traceback/error logs.
   - The Bug ID or Integration ID causing the issue.
   - Browser console errors (for UI-related issues).

---
*Document maintained by the AIBugTriage Engineering Team.*
