
## Status: All 5 Phases Complete ✅

## Structural Refactoring Plan

This plan is broken into **5 independent phases**, ordered from lowest risk to highest. Each phase can be tested in isolation before moving to the next. No user-facing behavior will change -- every phase produces the exact same UI and functionality.

### How We Avoid Breaking Things

- **One phase at a time**: each phase is a self-contained change that can be verified before proceeding
- **No behavior changes**: every phase is a pure refactor -- same inputs, same outputs, same user experience
- **Test after each phase**: you verify the app works exactly as before after each step
- **Rollback-friendly**: phases are independent, so if one causes issues we revert just that phase

---

### Phase 1: Wire Up `useTaskRealtime` Hook ✅

Replaced 4 inline realtime subscription `useEffect` blocks with a single `useTaskRealtime()` call.

### Phase 2: Use `FamilyDataContext` for Profile/Family Data ✅

`useMidnightTaskCleanup` and `useGoals` now consume `FamilyDataContext` instead of redundant profile fetches.

### Phase 3: Scope `GoalsProvider` to Goal Routes Only ✅

Moved `GoalsProvider` from global `App.tsx` wrapper to only the `/goals` route and specific dashboard tab contents.

### Phase 4: Extract Task Query Builder ✅

Created `src/utils/taskQueryBuilder.ts` with `TASK_SELECT_SHAPE`, `buildFamilyTaskQuery()`, and `castTasks()` as the single source of truth.

### Phase 5: Extract Dashboard Sub-Hooks ✅

Decomposed the 2195-line `ColumnBasedDashboard.tsx` into 4 focused hooks:

| Hook | File | Responsibility |
|------|------|----------------|
| `useDashboardTaskData` | `src/hooks/useDashboardTaskData.tsx` | Data fetching, realtime subscriptions, allTasks memo, materialized completions |
| `useDashboardNavigation` | `src/hooks/useDashboardNavigation.tsx` | Tab state, view mode, member filter, settings navigation |
| `useDashboardDragDrop` | `src/hooks/useDashboardDragDrop.tsx` | Drag-and-drop with droppable ID parsing and optimistic updates |
| `useDashboardTaskActions` | `src/hooks/useDashboardTaskActions.tsx` | Task toggle, completion, deletion, PIN gating |

`ColumnBasedDashboard.tsx` is now a ~550-line thin orchestrator that composes these hooks and renders the UI.
