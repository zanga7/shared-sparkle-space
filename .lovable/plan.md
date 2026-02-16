

## Auto-Complete Goals When End Date Passes

### What This Changes

When a goal's end date has passed, the system will automatically mark it as "completed", display final results, and make linked tasks read-only (no more toggling).

### How It Works

1. **Auto-completion check in `useGoals` (fetchGoals)** -- After fetching goals and progress, any goal whose end date (or consistency `time_window_days`) has passed and is still "active" or "paused" will be automatically updated to `status: 'completed'` in the database. This happens silently on each fetch.

2. **GoalCard completed state** -- When a goal is completed:
   - Hide the "Complete today's challenge" section and all task toggle controls
   - Show a final results summary (e.g., "Completed: 85%" or "28/30 days")
   - Keep the progress ring/grid visible but in a read-only, finalized style
   - Add a "Completed" badge (already exists)

3. **GoalDetailDialog completed state** -- When viewing a completed goal:
   - Show progress details as final results (read-only)
   - Hide task completion toggles (pass a `readOnly` prop to `LinkedTasksList`, `MilestoneList`, `MemberConsistencyGrid`)
   - Show the reward earned (if any) more prominently
   - Action buttons already hidden for completed goals (line 494 check exists)

### Technical Details

**File: `src/hooks/useGoals.tsx`**
- After building `goalsWithProgress` (line ~200), loop through goals where `status` is `active` or `paused` and the end date (or start_date + time_window_days for consistency) is in the past
- Batch-update those goals to `status: 'completed'` in the DB
- Update local state accordingly

**File: `src/components/goals/GoalCard.tsx`**
- Add an `isCompleted` flag (`goal.status === 'completed'`)
- When completed, skip rendering `EnhancedTaskItem` toggle sections (lines 439-531)
- Instead show a brief "Final result" summary

**File: `src/components/goals/GoalDetailDialog.tsx`**
- Pass `readOnly` behavior when `goal.status === 'completed'`:
  - `LinkedTasksList`: hide `onComplete` handler
  - `MilestoneList`: hide `onComplete`/`onUncomplete` handlers
  - `MemberConsistencyGrid`: hide `onTaskToggle` handler
- Display a "Goal Completed" banner at the top of the dialog

**File: `src/components/goals/LinkedTasksList.tsx`**
- Already supports `onComplete` being undefined (tasks just won't be toggleable)

**File: `src/components/goals/GoalCard.tsx` (getDaysRemaining)**
- When status is `completed`, show "Completed" instead of "Ended"

### Edge Cases
- Goals without an `end_date` are never auto-completed (they must be manually completed)
- Consistency goals use `start_date + time_window_days` as the effective end date
- Paused goals that have passed their end date will also be auto-completed
- The auto-completion only fires on fetch, so it happens when any family member opens the goals page

