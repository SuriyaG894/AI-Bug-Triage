# AI Bug Triage & Root Cause Analyzer

An intelligent system that automates the bug triage process by analyzing defect reports using AI. The application automatically categorizes bugs, suggests root causes, detects duplicates using semantic similarity (locally and across external trackers), and provides bidirectional integration with external platforms like Azure DevOps (ADO) and JIRA.

---

## 🏗️ Architecture Overview

The system is built as a multi-tier web application designed to run locally via Docker Compose or deploy to cloud platforms (like Vercel, Render, and Supabase):

```
┌─────────────────────────────────┐
│           Web Browser           │
│  React 18 + TS + Tailwind CSS   │
└─────────────────────────────────┘
                 │
                 │ HTTP / REST
                 ▼
┌─────────────────────────────────┐      FastMCP       ┌──────────────────────────────────────┐
│         FastAPI Backend         │ ─────────────────> │         DuplicateHunter MCP          │
│ Python 3.11 + SQLAlchemy Async  │                    │ Provides Local/ADO duplicate search  │
└─────────────────────────────────┘                    └──────────────────────────────────────┘
        │                 │
        ▼                 ▼
┌───────────────┐ ┌───────────────┐
│  PostgreSQL   │ │  Redis Cache  │
│  (pgvector)   │ │  (Optional)   │
└───────────────┘ └───────────────┘
```

---

## ✨ Core Features

### 1. Authentication & User Management
*   **Secure Authentication:** JWT-based user authorization with PBKDF2 password hashing.
*   **Password Reset Flow:** 6-digit OTP generation with email transmission (via SMTP) featuring secure 3-attempt lockout limits and expiration timers.
*   **Role-Based Access Control (RBAC):** Restricts certain administrative settings and global dashboards to Admins, while project-scoped views isolate standard users.
*   **Session Inactivity Timeout:** Monitors user interactivity (mouse movement, scroll, keypress, touch) in the frontend and displays a warning modal with a 10-second countdown when idle. Allows users to extend their session or log out. Session timeout duration is configurable from the Admin Settings.

### 2. AI-Powered Triage & Classification
*   **Auto-Classification:** Leverages the **Groq API** (`llama-3.1-8b-instant`) to predict severity (critical/high/medium/low) and type (ui/backend/api/data/security/performance) with confidence scores.
*   **Root Cause Analysis:** Generates 3 potential root causes and remedies upon bug registration.
*   **Semantic Search Embeddings:** Generates 384-dimensional dense vectors using `sentence-transformers/all-MiniLM-L6-v2` (via lightweight `fastembed`) and indexes them using `pgvector` in PostgreSQL.
*   **Rich Text Formatting:** Integrates `ReactQuill` to support rich formatting (bold, italic, list bullets/numbers, indentations) for *Steps to Reproduce*, *Expected Result*, and *Actual Result* fields instead of plain text, featuring HTML sanitization via `DOMPurify` on render.

### 3. Duplicate Bug Detection
*   **Multi-Phase Deduplication:**
    *   **Phase 1 (Embedding-Based):** Local semantic vector matching utilizing cosine similarity thresholds.
    *   **Phase 2 (Text-Based Fallback):** Token-based Jaccard similarity fallback calculation (weighted: 60% Title, 40% Description) with stop-word removal.
    *   **Phase 3 (External Check):** Query-based search checking for duplicates directly inside Azure DevOps (via WIQL) and JIRA (via JQL).
*   **Automatic Warnings:** Flags potential duplicates immediately on description blur during bug creation.
*   **Duplicate Justification Dialog:** Shows a modal asking for confirmation and justification when a potential duplicate is detected on Azure DevOps, which is logged with the defect record. Allows drilling down into similar bugs via local modal popups.

### 4. Integration & Bidirectional Sync
*   **Azure DevOps (ADO):** Full bidirectional sync supporting work item creation, status mapping, field patch updates, comment importing, attachment uploading, and deletion.
*   **JIRA:** Basic issue creation, project retrieval, and JQL-based search for duplicates.
*   **Sync Service:** Configurable background scheduler that polls for updates and resolves conflicts with an "ADO wins" policy.
*   **Credentials Security:** API tokens and PATs are encrypted at rest using XOR-based base64 encryption.

### 5. Real-Time Notifications
*   **Event-Driven Pub/Sub:** Publishes system events (assignment, status updates, deletion, sync updates) to subscribers to deliver real-time notifications.
*   **User Inbox & Header Badges:** Provides an unread count badge in the header dropdown and a dedicated `/notifications` management interface (with pagination, all/unread filtering, and event detail cards).
*   **Custom Settings:** Allows toggling email notification preferences.

### 6. Analytics Dashboard & Audit Logging
*   **Interactive Metrics:** Real-time data visualization of severity ratios, trend analyses, and common root causes using Recharts.
*   **Action Auditing:** Automatically logs key user actions (logins, creates, updates, and syncs) with auto-cleanup of logs older than 30 days.
*   **About Page:** Offers a dedicated `/about` page detailing the application version, key features, architecture tech stack details, and support escalation channels.

---

## 🛠️ Tech Stack

| Layer | Component | Technologies |
|---|---|---|
| **Frontend** | Framework & UI | React 18, TypeScript, Vite, Tailwind CSS, Headless UI, Lucide Icons |
| | Charts & State | Recharts, React Hook Form, React Hot Toast, Axios, ReactQuill, DOMPurify |
| **Backend** | Framework | FastAPI, Uvicorn, Python 3.11, Pydantic v2 |
| | Database | PostgreSQL, `pgvector`, SQLAlchemy (asyncpg), Alembic migrations |
| | Task Scheduler | Celery (with Redis) or custom async background task scheduler |
| **AI/ML** | Embedding | `fastembed` (all-MiniLM-L6-v2) |
| | LLM | Groq SDK (Llama models) |
| **Integrations** | Clients | Azure DevOps REST API, JIRA REST API |
| **Testing** | Frameworks | Pytest, Pytest-Asyncio, Playwright (E2E) |

---

## 🚀 Quick Start

### Prerequisites
*   Docker & Docker Compose installed.
*   A **Groq API Key** (obtainable from [Groq Console](https://console.groq.com/)).

### Local Docker Setup

1.  **Clone the repository** and navigate to the project root.
2.  **Initialize environment configuration:**
    ```bash
    cp .env.example .env
    cp backend/.env.example backend/.env
    cp frontend/.env.example frontend/.env
    ```
3.  **Update variables in `.env`:**
    *   Add your `GROQ_API_KEY` to the root `.env` or `backend/.env`.
    *   (Optional) Provide Azure DevOps/JIRA settings or SMTP parameters.
4.  **Spin up the services:**
    ```bash
    docker-compose up -d --build
    ```
5.  **Access the applications:**
    *   **Frontend Web App:** [http://localhost:5173](http://localhost:5173)
    *   **Backend FastAPI Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
    *   **PostgreSQL Port:** `5432`
    *   **Redis Port:** `6379`

### Manual Development Setup

If running without Docker, follow these instructions:

#### 1. Database Setup
Ensure PostgreSQL has the `pgvector` extension installed. Run the following in your database:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 2. Backend Execution
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Unix:
source venv/bin/activate

pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 3. Frontend Execution
```bash
cd frontend
npm install
npm run dev
```

---

## 🤖 Model Context Protocol (MCP) Server

The backend includes a standalone Model Context Protocol (MCP) server named `DuplicateHunter` to allow external tools (like Claude Desktop or OpenCode agents) to directly interact with the database and integration pipelines.

*   **File location:** [backend/mcp_server.py](file:///c:/Users/DELL/Downloads/opencode-learning/backend/mcp_server.py)
*   **Run command:** `python backend/mcp_server.py` (communicates over Standard I/O transport)

### Available MCP Elements

#### 🧰 Tools
*   `search_local_db(description, min_similarity, limit)`: Performs semantic cosine-similarity searches over local PostgreSQL embeddings.
*   `search_ado_duplicates(description, title, min_similarity)`: Searches active Azure DevOps work items using Jaccard and WIQL filters.
*   `check_duplicates(title, description, min_similarity)`: Runs parallel checks across both local DB and ADO.
*   `get_bug_details(bug_id)`: Fetches full JSON representation of a bug.
*   `list_recent_bugs(limit)`: Shows summary logs of the latest bugs.
*   `sync_ado_to_local(limit)`: Triggers a sync of work items from Azure DevOps to the local database.

#### 📂 Resources
*   `schema://main`: Exposes SQL Table models for AI agents to write query context.
*   `config://ado`: Exposes Azure DevOps configurations (Org, Project, connection health).

#### 💬 Prompts
*   `analyze_bug_prompt(bug_description)`: Renders pre-formatted instruction template asking the AI agent to analyze severity, duplicate status, and root cause of a defect.

---

## 📡 API Endpoints Summary

Below is an overview of the primary FastAPI endpoints. See Swagger docs (`/docs`) for full interactive payloads.

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user account. |
| `POST` | `/api/auth/login` | Log in and receive JWT token. |
| `GET` | `/api/auth/me` | Fetch active user credentials. |
| `PATCH` | `/api/auth/me` | Update profile information. |
| `POST` | `/api/auth/change-password` | Update current password. |
| `POST` | `/api/auth/forgot-password` | Request password reset OTP. |
| `POST` | `/api/auth/verify-otp` | Verify 6-digit OTP and receive reset token. |
| `POST` | `/api/auth/reset-password` | Submit new password using reset token. |
| `GET` | `/api/auth/session-timeout` | Get active user's session timeout settings. |

### Bug Tracker (`/api/bugs`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/bugs` | List bugs with filters (severity, status, search, project). |
| `POST` | `/api/bugs` | File a new bug (auto-classifies & indexes embedding). |
| `GET` | `/api/bugs/{id}` | Retrieve specific bug details, comments, and sync state. |
| `PUT` | `/api/bugs/{id}` | Update bug and push updates to ADO if configured. |
| `DELETE` | `/api/bugs/{id}` | Delete local bug and its ADO equivalent. |
| `POST` | `/api/bugs/check-duplicate` | Verify details against existing bugs. |
| `POST` | `/api/bugs/suggest` | Provide AI-suggested fields based on description. |

### Notifications (`/api/notifications`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/notifications` | List notifications with filters (unread only, pagination). |
| `GET` | `/api/notifications/unread-count` | Fetch current unread notification count. |
| `PUT` | `/api/notifications/{notification_id}/read` | Mark a specific notification as read. |
| `PUT` | `/api/notifications/read-all` | Mark all notifications for the user as read. |
| `GET` | `/api/notifications/settings` | Read notification settings (e.g. email notifications toggle). |
| `PUT` | `/api/notifications/settings` | Update notification settings. |

### Integrations & Sync (`/api/integrations` & `/api/sync`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/integrations` | List configure connectors. |
| `POST` | `/api/integrations` | Save new ADO or JIRA integration credentials. |
| `POST` | `/api/integrations/{id}/sync` | Trigger an on-demand sync cycle. |
| `GET` | `/api/sync/status` | Read state of background sync scheduler. |
| `POST` | `/api/sync/trigger` | Manually run a full ADO database sync. |
| `POST` | `/api/sync/trigger/{bug_id}` | Manually sync a single bug between systems. |

### Admin & Analytics (`/api/admin` & `/api/analytics`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/analytics/summary` | Read critical statistics (total bugs, severity ratios). |
| `GET` | `/api/analytics/trends` | Fetch creation counts over a timeline (default 30 days). |
| `GET` | `/api/admin/users` | List all users registered (Admin only). |
| `PATCH` | `/api/admin/users/{id}/role` | Promote/demote user roles. |
| `GET` | `/api/admin/audit-logs` | Fetch system audit logs. |
| `GET` | `/api/admin/settings/session-timeout` | Get session timeout settings (Admin only). |
| `POST` | `/api/admin/settings/session-timeout` | Update session timeout settings (Admin only). |
| `POST` | `/api/admin/settings/session-timeout/reset` | Reset session timeout settings to default (Admin only). |

---

## 🧪 Testing

The codebase includes integration API tests and End-to-End browser tests.

### Running Backend Tests
Execute unit/integration tests using Pytest:
```bash
cd backend
pytest tests/
```

### Running E2E UI Tests
Ensure you have the backend and frontend servers running locally, then execute:
```bash
# Ensure Playwright dependencies are set up
pip install playwright
playwright install

# Run the Playwright test suite
python tests/e2e/test_auth.py
python tests/e2e/test_frontend.py
```

---

## 🔍 Troubleshooting

### Groq Classifications Returning Default Values
*   **Symptom:** Auto-classification suggests "medium" severity with `0.5` confidence for all bugs.
*   **Resolution:** Verify your `GROQ_API_KEY` is properly loaded. Check backend terminal logs for key-decryption/connectivity errors.

### Semantic Search Duplicate Matches Missing
*   **Symptom:** Obvious duplicate descriptions are not caught.
*   **Resolution:** Ensure that `pgvector` is enabled on Postgres. Run Alembic migrations to construct the `bug_embeddings` table. If using local dev, run `python backend/scripts/regenerate_embeddings.py` to backfill missing vector indices.

### ADO / JIRA Sync Actions Failing
*   **Symptom:** Integrations tab shows errors or updates fail to reflect.
*   **Resolution:** Go to the Admin Panel Integrations screen and test credentials. Ensure the Personal Access Token (PAT) has valid read/write scope permissions for Azure DevOps work items.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
