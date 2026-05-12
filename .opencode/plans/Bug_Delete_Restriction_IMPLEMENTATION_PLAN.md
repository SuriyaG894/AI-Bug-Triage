# Bug Delete Restriction - Implementation Plan

## Feasibility: ✅ Fully Feasible

The Bug model already tracks `reporter_id` (creator's user ID) and `created_by` (creator's email). The current delete endpoint has no auth checks.

---

## 1. Backend Changes

### `backend/app/api/routes/bugs.py`

#### Delete Endpoint (lines 283-293)

**Current:**
```python
@router.delete("/{bug_id}")
async def delete_bug(bug_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bug).where(Bug.id == bug_id))
    bug = result.scalar_one_or_none()
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")
    await db.delete(bug)
    await db.commit()
    return {"message": "Bug deleted successfully"}
```

**New:**
- Add `current_user: Optional[User] = Depends(get_current_user_from_token)` dependency
- Authorization logic:
  - If `not current_user` → return 401 Unauthorized
  - If `current_user.is_admin` → allow delete
  - If `bug.reporter_id == current_user.id` → allow delete  
  - Else → return 403 Forbidden: "You can only delete bugs you created"
- Delete is already permanent (hard delete via `db.delete()`)

#### Bug List Endpoint (if not already)

- Ensure `created_by` field is returned in `BugResponse` schema (already defined)
- Verify the list endpoint includes `created_by` in the response

---

## 2. Frontend Changes

### `frontend/src/pages/BugListPage.tsx`

#### Add "Created By" Column

Add a new column to the DataTable columns array:

```typescript
{
  key: 'created_by',
  header: 'Created By',
  sortable: true,
  render: (bug) => (
    <span className="text-sm text-text-secondary">
      {bug.created_by || 'System'}
    </span>
  ),
}
```

Position: After "Status" column, before "Source" column.

#### Conditional Delete Button

Modify the actions column to only render the Delete button when:

```typescript
const canDelete = user?.is_admin || (bug.created_by && bug.created_by === user?.email);

// In render:
{canDelete && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      setDeleteBug(bug);
    }}
    className="text-red-600 hover:text-red-800 text-sm font-medium"
  >
    Delete
  </button>
)}
```

#### Update Delete Confirmation Message

```typescript
message={`Are you sure you want to delete "${deleteBug?.title}"? This action cannot be undone.`}
```

Add a note: "This will permanently delete the bug from the database."

---

## 3. API Type Updates

### `frontend/src/services/api.ts`

The `Bug` interface already has `created_by: string | null` and `reporter_id?: number | null`. No changes needed.

---

## Open Questions

1. **Should admins be able to delete any bug?**
   - Proposed: Yes, admins can delete any bug

2. **Should synced bugs (from ADO) be deletable?**
   - Proposed: Yes, if created_by is null, only admins can delete

3. **Error message for unauthorized delete:**
   - Proposed: "You don't have permission to delete this bug" (clearer feedback)

4. **Should the delete button be hidden or disabled for non-creators?**
   - Proposed: Hidden (cleaner UX)

---

## Testing Checklist

- [ ] Non-admin user can delete their own bug
- [ ] Non-admin user cannot delete another user's bug
- [ ] Admin user can delete any bug
- [ ] Bug is permanently removed from database
- [ ] "Created By" column appears in bug list
- [ ] Delete button only visible to creator or admin
- [ ] API returns 403 for unauthorized delete attempts
- [ ] Synced bugs (no creator) only deletable by admin
