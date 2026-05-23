# AIBugTriage - End-to-End Support Guide

## 1. Application Overview
AIBugTriage is an intelligent system that automates the bug triage process by analyzing defect reports using AI. It integrates with existing issue tracking systems like Azure DevOps and JIRA, automatically categorizes bugs by severity and type, detects duplicates using semantic similarity, and suggests root causes.

## 2. Architecture & Tech Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Recharts, ReactQuill, DOMPurify
- **Backend:** Python FastAPI, SQLAlchemy, Uvicorn
- **Database:** PostgreSQL (with `pgvector` extension)
- **AI/ML:** Groq API (llama-3.1-8b-instant), fastembed (all-MiniLM-L6-v2)
- **Integrations:** Azure DevOps REST API, JIRA REST API
- **Infrastructure:** Docker Compose, Redis (Optional), Vercel (Frontend), Render (Backend), Supabase (Database)

## 3. Core Features
- **User Authentication & Session Management:** JWT-based auth, password reset via OTP, Role-based access control (Admin/User), and an inactivity session timeout handler.
- **AI-Powered Bug Analysis & Rich Formatting:**
  - Auto-classification of severity and type.
  - Root cause analysis suggestion with confidence scores.
  - Rich text formatting support using `ReactQuill` for reproduction steps, expected result, and actual result.
- **Duplicate Detection & Justification:** 
  - Semantic matching using `pgvector` embeddings.
  - Text-based Jaccard similarity fallback.
  - External duplicate bug check with a mandatory justification popup when saving defects with potential duplicates in Azure DevOps.
- **Integrations:** Two-way sync with Azure DevOps (ADO) and basic JIRA support. Supports pushing bugs, syncing statuses, and deduplicating.
- **Real-Time Notifications:** Event-driven notification publisher triggers messages for bug assignment, status changes, and deletions, visible via a header dropdown and a dedicated notifications manager.
- **Analytics & About Page:** Dashboard showing bug metrics and trend analytics, along with a dedicated `/about` page detailing the app version and support details.
- **Audit Logging:** Comprehensive tracking of user actions (login, bug creation, edits, integrations, etc.).

## 4. Environment & Deployment Setup
For local deployment and environment guidelines, refer to the [README.md](../README.md).

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

### 5.6 Session Inactivity Handler / Unexpected Logout
- **Symptom:** User is logged out after short inactivity or gets unexpected warning dialogs.
- **Cause:** The system session timeout setting is configured to a very low duration, or user interactions (mouse, scroll, typing) are not registering due to browser overlay interferences.
- **Resolution:** 
  - Admin users can check the timeout duration configuration in the Admin settings panel (default fallback is 2 hours).
  - Verify that the browser is not aggressively throttling timer execution when inactive.

### 5.7 Notifications Not Appearing / Real-Time Sync Issues
- **Symptom:** Notifications are not generated when bugs are assigned, deleted, or status is synced.
- **Cause:** Pub/sub subscriber events failed to process, or user settings have disabled notifications.
- **Resolution:**
  - Verify notification settings endpoint `/notifications/settings` and user preferences toggles.
  - Inspect backend service logs to ensure event triggers are executing without database constraints errors in `notification_subscriber.py`.

### 5.8 Rich Text Styling / Formatting Errors
- **Symptom:** HTML tags are visible in details, or format styles break page layouts.
- **Cause:** Output text was stored as unpurified HTML strings, or styling was not safely rendered.
- **Resolution:** 
  - Ensure the frontend renders content through `DOMPurify.sanitize` and properly styles tags nested in rich-content containers.

### 5.9 Duplicate Justification Modal Missing or Bypassed
- **Symptom:** Defect was saved/pushed without prompt for justification despite duplicate records in Azure DevOps.
- **Cause:** External check returned API timeout or validation was skipped because the project was not selected.
- **Resolution:**
  - Verify that a project is properly selected (which is mandatory for non-admin users).
  - Verify connectivity health of Azure DevOps integration under the Admin Integrations screen.

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
