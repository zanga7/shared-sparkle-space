
## Status: Phases 1-4 Complete | Phase 5 Remaining

## Structural Refactoring Plan

This plan is broken into **5 independent phases**, ordered from lowest risk to highest. Each phase can be tested in isolation before moving to the next. No user-facing behavior will change -- every phase produces the exact same UI and functionality.

### How We Avoid Breaking Things

- **One phase at a time**: each phase is a self-contained change that can be verified before proceeding
- **No behavior changes**: every phase is a pure refactor -- same inputs, same outputs, same user experience
- **Test after each phase**: you verify the app works exactly as before after each step
- **Rollback-friendly**: phases are independent, so if one causes issues we revert just that phase

---

### Phase 1: Wire Up `useTaskRealtime` Hook (Remove Duplicated Subscriptions)

**Risk: Low | Impact: High (removes ~250 lines of duplication)**

The `useTaskRealtime` hook already exists at `src/hooks/useTaskRealtime.tsx` with the exact same subscription logic that is copy-pasted inline in `ColumnBasedDashboard.tsx` (lines 182-529). The dashboard creates 4 separate realtime channels that the hook already handles.

**What changes:**
- In `ColumnBasedDashboard.tsx`, replace the 4 inline `useEffect` blocks (task inserts, task completions, task assignees, series changes) with a single `useTaskRealtime()` call
- Pass callback handlers that update local state (the same `setTasks` logic currently inline)
- Remove the duplicate channel subscriptions
- Keep the profiles subscription (line 535-594) as-is since `useTaskRealtime` doesn't cover it

**What stays the same:**
- The retry logic for assignee hydration (currently in dashboard but not in the hook) will be added to the hook's `onTaskInserted` handler
- The completion UPDATE handler (lines 496-523) will be added to `useTaskRealtime` 
- All toast messages, console logs, and state updates remain identical

---

### Phase 2: Use `FamilyDataContext` for Profile/Family Data

**Risk: Low | Impact: Medium (eliminates redundant profile fetches)**

`FamilyDataContext` already exists, is already mounted in `App.tsx`, and already fetches `familyMembers`, `rewards`, and `householdSettings` -- but nothing uses it. Meanwhile, `ColumnBasedDashboard`, `useGoals`, and `useMidnightTaskCleanup` each independently fetch the same profile data.

**What changes:**
- `useMidnightTaskCleanup`: replace the inline profile fetch with `useFamilyData()` to get `familyId` directly
- `useGoals`: replace its own profile fetch `useEffect` with `useFamilyData()` to get `familyId` and `profileId`
- `ColumnBasedDashboard`: consume `familyMembers` from `useFamilyData()` as the initial source, while keeping local `setFamilyMembers` for realtime point updates (the context cache has a 5-min stale time, so realtime updates still flow through local state)

**What stays the same:**
- All data shapes remain identical
- All queries return the same results
- The dashboard still manages its own `profile` state for the full profile object (display_name, role, etc.) since `FamilyDataContext` only stores a subset

---

### Phase 3: Scope `GoalsProvider` to Goal Routes Only

**Risk: Low | Impact: Low-Medium (reduces unnecessary fetching)**

`GoalsProvider` currently wraps the entire app in `App.tsx`, meaning it fetches all goals data even on auth pages, admin pages, and the main dashboard. Only 5 components actually use `useGoals()`: `GoalsContent`, `GoalDetailDialog`, `EditGoalDialog`, `CreateGoalDialog`, and `FamilyDashboard`.

**What changes:**
- Move `GoalsProvider` from `App.tsx` to wrap only the routes/components that need it:
  - The Goals page (`/goals`)
  - The `FamilyDashboard` component (which shows active goals in a widget)
  - The `GoalsContent` component (rendered inside `ColumnBasedDashboard` tabs)
- Add a local `GoalsProvider` wrapper inside `ColumnBasedDashboard` around the goals tab content and family dashboard tab content

**What stays the same:**
- All goal functionality works identically
- The FamilyDashboard goals widget still shows active goals
- Goal creation/editing dialogs still work

---

### Phase 4: Extract Task Query Builder

**Risk: Low | Impact: Medium (single source of truth for task shape)**

The same task `.select()` query with joins appears in 6+ places across the codebase (dashboard fetches, realtime handlers, `useGoalLinkedTasks`, `MemberTasksWidget`). Any time a column is added/removed, all copies must be updated.

**What changes:**
- Create `src/utils/taskQueryBuilder.ts` with a shared constant for the task select shape
- Create a helper function `buildTaskQuery(supabase, filters)` that returns the standard query
- Replace all duplicated `.select()` calls with the shared builder

**What stays the same:**
- Every query returns exactly the same columns and joins
- No behavioral change at all

---

### Phase 5: Extract Dashboard Sub-Hooks

**Risk: Medium | Impact: High (makes ColumnBasedDashboard maintainable)**

After phases 1-4 reduce the dashboard by ~400 lines, extract the remaining logic into focused hooks. This is the largest phase but by this point the component is already cleaner.

**What changes:**
- `useTaskData(familyId)`: handles `fetchUserData`, `refreshTasksOnly`, `allTasks` memo, materialized completions map
- `useDashboardNavigation()`: handles `activeTab`, `viewMode`, `selectedMemberFilter`, tab/member selection logic
- `useTaskDragDrop(tasks, setTasks, profile, familyMembers)`: handles `handleDragEnd` with all its parsing logic
- `useTaskActions(profile, dashboardMode, ...)`: handles `handleTaskToggle`, `completeTask`, `uncompleteTask`, `initiateTaskDeletion`, `deleteTask`
- `ColumnBasedDashboard.tsx` becomes a thin orchestrator (~500 lines) that composes these hooks and renders the UI

**What stays the same:**
- Every user interaction produces exactly the same result
- State flows remain identical (hooks share state via parameters, not new contexts)
- All drag-and-drop, PIN gating, completion toggling, and realtime updates work as before

---

### Execution Order

| Phase | Files Changed | Lines Removed | Risk |
|-------|--------------|---------------|------|
| 1 | 2 files | ~250 | Low |
| 2 | 3 files | ~40 | Low |
| 3 | 2-3 files | ~5 (moved) | Low |
| 4 | 6-8 files | ~100 (deduped) | Low |
| 5 | 5-6 files (new hooks) | ~1500 (moved) | Medium |

Each phase should be followed by a full app test before proceeding to the next.

