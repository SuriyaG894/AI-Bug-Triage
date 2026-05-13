# ADO Bidirectional Sync — Implementation

## Problem

1. **3 separate sync mechanisms** (CLI, SyncService, MCP) — all inconsistent
2. **No update logic** — ADO bugs synced to `bugs` table are **insert-only** (skip if `external_id` exists)
3. **No status/assignment/comment sync** — these are never read from ADO
4. **No comments model** in the local database
5. **Dual cache** — SyncService writes to `external_issue_cache`, CLI/MCP write to `bugs` table, data diverges

## Steps Completed

### Step 1: BugComment + SyncState models (database.py)
- `BugComment` table: id, bug_id (FK→bugs CASCADE), external_comment_id, author, body, created_at, updated_at
- `SyncState` table: id, bug_id (FK→bugs CASCADE, unique), external_id, last_synced_at, external_updated_at, status
- Added `last_external_updated_at` to `Bug` model

### Step 2: Alembic migration 002
- Creates bug_comments, sync_state tables
- Adds last_external_updated_at to bugs

### Step 3: Field mapping utility (field_mapping.py)
- ADO_STATUS_TO_LOCAL mapping (New→open, Active→open, etc.)
- ADO_SEVERITY_TO_LOCAL mapping
- ado_to_local() function
- strip_html() helper

### Step 4: Extend ADO client
- `get_work_item_details(external_id)` — full field fetch
- `get_work_item_comments(external_id)` — discussion comments
- `get_work_item_revisions(external_id, since)` — for delta sync

### Step 5: Rewrite SyncService
- Unified single entry point
- Update logic (not just insert)
- Comment sync
- Conflict detection (ADO wins)
- Backfill support
- Uses SQLAlchemy instead of raw asyncpg

### Step 6: Push sync on local update
- Bug PUT endpoint pushes to ADO if push_to_external is True
- Updates last_external_updated_at and sync_state

### Step 7: Unify CLI sync
- sync_from_ado() delegates to sync_service.sync_ado_bugs()

### Step 8: Unify MCP server sync
- sync_ado_to_local() calls API endpoint

### Step 9: New API endpoints
- GET /api/sync/status — extended status
- POST /api/sync/trigger/{bug_id} — per-bug sync
- GET /api/bugs/{bug_id}/sync-info — sync state
- POST /api/bugs/{bug_id}/resolve-conflict — resolve

### Step 10: Pydantic schemas
- BugCommentResponse
- SyncStateResponse
- BugWithSyncResponse

### Step 11: Fix stub endpoint
- POST /api/integrations/{id}/sync now actually syncs

## Status Mapping (ADO → Local)

| ADO State | Local Status |
|-----------|--------------|
| New | open |
| Active | open |
| Reopened | open |
| Resolved | resolved |
| Retest Passed | resolved |
| Closed | closed |
| Rejected | closed |

## Severity Mapping (ADO → Local)

| ADO Severity | Local Severity |
|--------------|----------------|
| 1 - Critical | critical |
| 2 - High | high |
| 3 - Medium | medium |
| 4 - Low | low |

## Key Decisions

- Conflict resolution: ADO always wins
- Comment sync: Yes, new bug_comments table
- Backfill existing bugs: Yes, on first run
- Sync interval: 15 minutes (unchanged)
- Uses existing SQLAlchemy models, no raw asyncpg
