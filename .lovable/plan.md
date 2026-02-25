

# Performance Audit and Refactor Plan

## Summary of Root Causes

After tracing every data-fetching and mutation path, I've identified **6 critical performance problems** that compound to create the sluggish, reload-heavy experience you're seeing. None of these require changing any user-facing behaviour.

---

## Problem 1: Catastrophic N+1 Hook Duplication in GoalCard

**What's happening:** Every `GoalCard` component independently calls three heavy hooks:
- `useGoalLinkedTasks(goal.linked_tasks)` -- makes 3-4 Supabase queries per goal
- `useConsistencyCompletions(goal)` -- makes 2-3 Supabase queries per consistency goal
- `useTargetCompletions(goal)` -- makes 2-3 Supabase queries per target goal

With 6 goals displayed, that's **18-30 separate database round trips** just to render the goals list. Meanwhile, `GoalsContent` *also* calls `useGoalLinkedTasks(allLinkedTasks)` for all goals combined, duplicating all of that work.

**Fix:** Lift data fetching to `GoalsContent` (which already fetches all linked tasks) and pass the pre-fetched data down to each `GoalCard` as props. Convert `GoalCard` to accept `tasksMap`, `familyMembers`, `completionsByMember`, and `targetCompletionsByMember` as props instead of fetching them internally.

- Remove `useGoalLinkedTasks`, `useConsistencyCompletions`, and `useTargetCompletions` calls from `GoalCard`
- In `GoalsContent`, call `useConsistencyCompletions` and `useTargetCompletions` once each (using aggregated goal data) or batch the queries
- Pass results down via props
- **Expected improvement:** ~80% reduction in database queries on the Goals page

---

## Problem 2: `refetchOnWindowFocus: true` Causes Full Reload on Tab Switch

**What's happening:** The global React Query config has `refetchOnWindowFocus: true`. Every time you switch to another tab and come back, **all active queries re-fire simultaneously**. Combined with Problem 1, this means 20-30+ queries fire on every tab return.

**Fix:** Set `refetchOnWindowFocus: false` globally in the QueryClient configuration (line 81 of `App.tsx`). The app already has Supabase Realtime subscriptions and custom `task-updated` events for keeping data fresh -- the focus refetch is redundant and harmful.

```
File: src/App.tsx, line 81
Change: refetchOnWindowFocus: true -> refetchOnWindowFocus: false
```

---

## Problem 3: `task-updated` Event Triggers Cascading Full Refetches

**What's happening:** When a task is completed on the Goals page, the flow is:

1. `completeTask()` succeeds
2. Callback calls `refetchLinkedTasks()` (invalidates 5 React Query keys)
3. Callback calls `fetchGoals()` (makes ~8 sequential Supabase queries)
4. Callback dispatches `window.dispatchEvent('task-updated')`
5. `useGoals` listener calls `fetchGoals()` **again**
6. `useDashboardTaskData` listener calls `refreshTasksOnly()` (makes ~5 more queries)
7. `useConsistencyCompletions` listener increments counter, triggering re-fetch
8. `useTargetCompletions` listener increments counter, triggering re-fetch
9. `useGoalLinkedTasks` listener calls `refetch()` (invalidates 5 keys again)

That's **3-4 full data reloads** triggered by a single task toggle. The UI appears to "reload" because `fetchGoals()` sets `loading: true` at the start, which shows skeleton placeholders.

**Fix:**
- In `GoalsContent.handleTaskToggle`, remove the explicit `fetchGoals()` call from the callback -- the `task-updated` event already triggers it
- In `useGoals`, do NOT set `loading: true` when refetching due to `task-updated` (only on initial load). Use a separate `refreshing` flag or skip `setLoading(true)` when goals already exist
- Deduplicate: add a simple debounce/guard in `fetchGoals` to prevent concurrent calls
- In `useGoalLinkedTasks`, the `task-updated` listener already invalidates queries -- remove the explicit `refetchLinkedTasks()` call from the toggle callback

---

## Problem 4: `fetchGoals()` Shows Loading Skeletons on Every Refresh

**What's happening:** `fetchGoals()` (line 46 of useGoals.tsx) always calls `setLoading(true)` at the start. This replaces the entire goals list with skeleton placeholders during every refresh -- even when the data is simply being updated in the background. This is what makes the page "flash" or appear to reload.

**Fix:** Only show loading state on the initial fetch. For subsequent refreshes, keep existing data visible while fetching in the background.

```
// In fetchGoals:
const isInitialLoad = goals.length === 0;
if (isInitialLoad) setLoading(true);
// ... fetch logic ...
// setLoading(false) stays at the end
```

---

## Problem 5: `useConsistencyCompletions` and `useTargetCompletions` Use Raw useEffect Instead of React Query

**What's happening:** These hooks use `useState` + `useEffect` with manual Supabase calls instead of React Query. This means:
- No caching -- every re-render re-fetches
- No deduplication -- multiple components calling the same hook fire separate requests
- `goal?.linked_tasks` in the dependency array changes reference on every `fetchGoals()` call, triggering unnecessary re-fetches

**Fix:** Convert both hooks to use `useQuery` with stable query keys. This provides automatic caching, deduplication, and stale-while-revalidate behaviour.

```typescript
// useConsistencyCompletions - convert to useQuery pattern
export function useConsistencyCompletions(goal: Goal | null) {
  const goalId = goal?.id;
  const isConsistency = goal?.goal_type === 'consistency';
  
  const { data, isLoading } = useQuery({
    queryKey: ['consistency-completions', goalId],
    queryFn: async () => { /* existing fetch logic */ },
    enabled: !!goalId && isConsistency,
    staleTime: 30_000,
  });
  
  return {
    completionsByMember: data?.completionsByMember ?? {},
    allCompletedDates: data?.allCompletedDates ?? [],
    loading: isLoading,
  };
}
```

Same pattern for `useTargetCompletions`. The `task-updated` event listener triggers `queryClient.invalidateQueries` on the specific key instead of incrementing a counter.

---

## Problem 6: `refreshTasksOnly()` Over-Fetches

**What's happening:** `refreshTasksOnly()` in `useDashboardTaskData` (line 374) fetches:
1. All tasks for the family
2. All materialized task instances 
3. The current user's profile
4. All family members
5. All task series

This runs on every `task-updated` event, even when the dashboard isn't visible.

**Fix:**
- Only run `refreshTasksOnly()` if the dashboard component is actually mounted (it may not be if user is on the Goals page)
- Skip the profiles/members fetch since those are already kept fresh by the Realtime subscription
- Add a debounce to prevent multiple rapid calls

---

## Implementation Sequence

### Phase 1: Stop the Bleeding (highest impact, lowest risk)
1. **Disable `refetchOnWindowFocus`** in `App.tsx` -- single line change
2. **Remove `setLoading(true)` on non-initial fetches** in `useGoals.tsx` -- eliminates the visual "reload"
3. **Deduplicate the `task-updated` cascade** in `GoalsContent.tsx` -- remove redundant `fetchGoals()` and `refetchLinkedTasks()` from the toggle callback

### Phase 2: Eliminate N+1 Queries
4. **Lift hooks out of `GoalCard`** -- remove `useGoalLinkedTasks`, `useConsistencyCompletions`, `useTargetCompletions` from each card; pass data as props from `GoalsContent`
5. **Convert completion hooks to React Query** -- `useConsistencyCompletions` and `useTargetCompletions` use `useQuery` with stable keys

### Phase 3: Optimise Background Refreshes  
6. **Slim down `refreshTasksOnly()`** -- remove redundant profile/member fetches
7. **Add debounce guard** to `fetchGoals()` to prevent concurrent calls

---

## Files to Modify

| File | Change |
|---|---|
| `src/App.tsx` | Set `refetchOnWindowFocus: false` |
| `src/hooks/useGoals.tsx` | Skip loading state on re-fetches; add concurrency guard |
| `src/components/goals/GoalsContent.tsx` | Remove redundant refetch calls from toggle callback; aggregate completion data for cards |
| `src/components/goals/GoalCard.tsx` | Accept pre-fetched data as props instead of calling hooks internally |
| `src/hooks/useConsistencyCompletions.tsx` | Convert to React Query pattern |
| `src/hooks/useTargetCompletions.tsx` | Convert to React Query pattern |
| `src/hooks/useGoalLinkedTasks.tsx` | Remove redundant `task-updated` handler (React Query invalidation handles it) |
| `src/hooks/useDashboardTaskData.tsx` | Slim down `refreshTasksOnly()`; add debounce |

## What Will NOT Change
- All task completion/uncompletion logic
- All goal CRUD operations
- All UI components and layouts
- All Supabase Realtime subscriptions
- All drag-and-drop functionality
- All routing and navigation
- All reward/list/calendar features

