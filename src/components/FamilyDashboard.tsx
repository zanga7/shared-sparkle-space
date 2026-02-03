import { useMemo, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { useMemberColor } from '@/hooks/useMemberColor';
import { useEvents } from '@/hooks/useEvents';
import { useRewards } from '@/hooks/useRewards';
import { useGoals } from '@/hooks/useGoals';
import { Profile, Task } from '@/types/task';
import { GoalProgressRing } from '@/components/goals/GoalProgressRing';
import {
  CheckSquare, 
  Calendar, 
  Trophy,
  Gift,
  Target
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { motion } from 'framer-motion';

interface FamilyDashboardProps {
  familyMembers: Profile[];
  tasks: Task[];
  familyId: string;
  onNavigateToTasks: () => void;
  onNavigateToCalendar?: () => void;
  onNavigateToGoals?: () => void;
  onMemberSelect: (memberId: string) => void;
}

// Member card component with split layout - avatar left, stats right
const MemberStatCard = memo(({ 
  member, 
  todayTaskCount, 
  completedCount,
  todayEventCount,
  onViewDashboard 
}: { 
  member: Profile; 
  todayTaskCount: number;
  completedCount: number;
  todayEventCount: number;
  onViewDashboard: () => void;
}) => {
  const { hex } = useMemberColor(member.color);
  const progressPercent = todayTaskCount > 0 ? (completedCount / todayTaskCount) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className="relative overflow-hidden cursor-pointer group transition-all duration-300 hover:shadow-xl border-0"
        onClick={onViewDashboard}
      >
        <div className="flex">
          {/* Left column - Avatar and Name (25% width, white background) */}
          <div className="w-1/4 flex flex-col items-center justify-center p-3 bg-muted/50 rounded-l-lg">
            <UserAvatar 
              name={member.display_name} 
              color={member.color}
              avatarIcon={member.avatar_url || undefined}
              size="lg"
              className="w-14 h-14"
            />
            <p className="text-xs font-medium text-center mt-2 text-foreground truncate w-full">
              {member.display_name}
            </p>
          </div>

          {/* Right column - Stats (75% width, member color background) */}
          <div className="w-3/4 relative" style={{ backgroundColor: hex }}>
            {/* Gradient overlay for depth */}
            <div 
              className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2), transparent)' }}
            />
            
            <CardContent className="p-3 relative">
              {/* Points display */}
              <div className="flex items-center gap-1 mb-3">
                <Trophy className="h-4 w-4 text-white/80" />
                <span className="text-2xl font-bold text-white">
                  {member.total_points}
                </span>
              </div>
              
              {/* Task progress */}
              <div className="space-y-1.5 mb-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-white/80">
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span>Tasks</span>
                    {progressPercent === 100 && todayTaskCount > 0 && (
                      <span className="ml-1">🎉</span>
                    )}
                  </div>
                  <span className="font-medium text-white">{completedCount}/{todayTaskCount}</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full rounded-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  />
                </div>
              </div>

              {/* Events count */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-white/80">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Events</span>
                </div>
                <span className="font-medium text-white">{todayEventCount}</span>
              </div>
            </CardContent>
          </div>
        </div>
      </Card>
    </motion.div>
  );
});
MemberStatCard.displayName = 'MemberStatCard';

// Today's events widget
const TodayEventsWidget = memo(({ events, onViewCalendar }: { events: any[]; onViewCalendar?: () => void }) => {
  const today = startOfDay(new Date());
  const todayEnd = endOfDay(today);
  
  const todayEvents = events
    .filter(event => {
      const eventDate = new Date(event.start_date);
      return eventDate >= today && eventDate <= todayEnd;
    })
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  return (
    <div className="h-full flex flex-col">
      <div className="pb-4 pt-4 px-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Calendar className="h-5 w-5 text-primary" />
            Today's Schedule
          </h2>
          {onViewCalendar && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onViewCalendar}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              View Calendar
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        {todayEvents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No events scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {todayEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {event.is_all_day ? 'All day' : format(new Date(event.start_date), 'h:mm a')}
                    {event.location && ` • ${event.location}`}
                  </p>
                </div>
                {event.attendees && event.attendees.length > 0 && (
                  <div className="flex gap-1">
                    {event.attendees.slice(0, 3).map((attendee: any) => (
                      <UserAvatar
                        key={attendee.profile_id}
                        name={attendee.profile?.display_name || 'Unknown'}
                        color={attendee.profile?.color}
                        avatarIcon={attendee.profile?.avatar_url || undefined}
                        size="sm"
                      />
                    ))}
                    {event.attendees.length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                        +{event.attendees.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
TodayEventsWidget.displayName = 'TodayEventsWidget';

// Rewards widget - compact version for sidebar
const RewardsWidget = memo(({ rewards }: { rewards: any[] }) => {
  const activeRewards = rewards.filter(r => r.is_active);

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Gift className="h-5 w-5 text-primary" />
          Available Rewards
        </h2>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4">
        {activeRewards.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <Gift className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No rewards available</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {activeRewards.slice(0, 4).map((reward, index) => (
              <motion.div
                key={reward.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                    {reward.image_url ? (
                      <img 
                        src={reward.image_url} 
                        alt={reward.title}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <Gift className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{reward.title}</p>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <Trophy className="h-3 w-3 text-amber-500" />
                  {reward.cost_points}
                </Badge>
              </motion.div>
            ))}
            {activeRewards.length > 4 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                +{activeRewards.length - 4} more rewards
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
RewardsWidget.displayName = 'RewardsWidget';

// Compact consistency grid for dashboard - uses the ConsistencyProgressGrid logic
const CompactConsistencyGrid = memo(({ goal }: { goal: any }) => {
  // For consistency goals, we need to fetch completion data
  // The progress object has total_completions but not the specific dates
  // So we show a simple progress indicator based on the data we have
  const progress = goal.progress;
  const totalCompletions = progress?.total_completions || 0;
  const expectedCompletions = progress?.expected_completions || 1;
  
  // Show 7 boxes representing the last 7 expected completions
  const boxes = Array.from({ length: 7 }, (_, i) => {
    // Fill boxes based on completion ratio
    const filledBoxes = Math.min(7, Math.round((totalCompletions / Math.max(expectedCompletions, 1)) * 7));
    return i < filledBoxes;
  });
  
  return (
    <div className="flex gap-0.5">
      {boxes.map((isCompleted, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-sm ${
            isCompleted 
              ? 'bg-green-500' 
              : i === boxes.length - 1 
                ? 'bg-muted ring-1 ring-primary/50' 
                : 'bg-muted/50'
          }`}
        />
      ))}
    </div>
  );
});
CompactConsistencyGrid.displayName = 'CompactConsistencyGrid';

// Goals widget
const GoalsWidget = memo(({ goals, onNavigateToGoals }: { goals: any[]; onNavigateToGoals?: () => void }) => {
  const activeGoals = goals.filter(g => g.status === 'active');

  return (
    <div className="h-full flex flex-col">
      <div className="pb-4 pt-4 px-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Target className="h-5 w-5 text-primary" />
            Family Goals
          </h2>
          {onNavigateToGoals && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onNavigateToGoals}
              className="gap-2"
            >
              <Target className="h-4 w-4" />
              View All
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        {activeGoals.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Target className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No active goals</p>
            <p className="text-xs mt-1">Create a goal to track family progress</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {activeGoals.slice(0, 5).map((goal, index) => {
              const progressPercent = goal.progress?.current_percent ?? 0;
              const isConsistency = goal.goal_type === 'consistency';
              
              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{goal.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="capitalize">{goal.goal_type.replace('_', ' ')}</span>
                      {goal.assignees && goal.assignees.length > 0 && (
                        <>
                          <span>•</span>
                          <div className="flex gap-1">
                            {goal.assignees.slice(0, 3).map((assignee: any) => (
                              <UserAvatar
                                key={assignee.profile_id}
                                name={assignee.profile?.display_name || 'Unknown'}
                                color={assignee.profile?.color}
                                avatarIcon={assignee.profile?.avatar_url || undefined}
                                size="xs"
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(progressPercent)}%
                  </Badge>
                </motion.div>
              );
            })}
            {activeGoals.length > 5 && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                +{activeGoals.length - 5} more goals
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
GoalsWidget.displayName = 'GoalsWidget';

export const FamilyDashboard = memo(({
  familyMembers,
  tasks,
  familyId,
  onNavigateToTasks,
  onNavigateToCalendar,
  onNavigateToGoals,
  onMemberSelect
}: FamilyDashboardProps) => {
  const { events = [] } = useEvents(familyId);
  const { rewards = [] } = useRewards();
  const { goals = [] } = useGoals();
  
  // Calculate today's events for each member
  const todayMemberEvents = useMemo(() => {
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(today);
    
    const memberEventCounts: Record<string, number> = {};
    
    familyMembers.forEach(member => {
      memberEventCounts[member.id] = 0;
    });
    
    events.forEach(event => {
      const eventDate = new Date(event.start_date);
      if (eventDate >= today && eventDate <= todayEnd) {
        // Count events for each attendee
        if (event.attendees && event.attendees.length > 0) {
          event.attendees.forEach((attendee: any) => {
            if (memberEventCounts[attendee.profile_id] !== undefined) {
              memberEventCounts[attendee.profile_id]++;
            }
          });
        }
      }
    });
    
    return memberEventCounts;
  }, [events, familyMembers]);

  // Calculate task stats for each member
  const memberStats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    return familyMembers.map(member => {
      const memberTasks = tasks.filter(task => {
        // Check if task is assigned to this member
        const isAssigned = task.assigned_to === member.id || 
          task.assignees?.some(a => a.profile_id === member.id);
        
        if (!isAssigned) return false;
        
        // Check if it's today's task (by due_date or occurrence_date)
        const taskDate = (task as any).occurrence_date || task.due_date;
        if (!taskDate) return true; // Include tasks without dates
        
        return taskDate.startsWith(today);
      });
      
      const completedTasks = memberTasks.filter(task => 
        task.task_completions && task.task_completions.length > 0
      );
      
      return {
        member,
        todayTaskCount: memberTasks.length,
        completedCount: completedTasks.length,
        todayEventCount: todayMemberEvents[member.id] || 0
      };
    });
  }, [familyMembers, tasks, todayMemberEvents]);

  // Sort members by points (descending)
  const sortedMemberStats = useMemo(() => {
    return [...memberStats].sort((a, b) => b.member.total_points - a.member.total_points);
  }, [memberStats]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-left">
          {format(new Date(), 'EEEE, MMMM do, yyyy')}
        </h1>
      </motion.div>

      {/* Main content grid - 3 columns with aligned headers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column - Leaderboard + Rewards */}
        <div className="space-y-6">
          <div>
            <div className="pb-4 pt-4 px-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <Trophy className="h-5 w-5 text-primary" />
                  Leaderboard
                </h2>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onNavigateToTasks}
                  className="gap-2"
                >
                  <CheckSquare className="h-4 w-4" />
                  Tasks
                </Button>
              </div>
            </div>
            <div className="px-4 space-y-3">
              {sortedMemberStats.map((stat) => (
                <MemberStatCard
                  key={stat.member.id}
                  member={stat.member}
                  todayTaskCount={stat.todayTaskCount}
                  completedCount={stat.completedCount}
                  todayEventCount={stat.todayEventCount}
                  onViewDashboard={() => onMemberSelect(stat.member.id)}
                />
              ))}
            </div>
          </div>
          
          {/* Rewards under leaderboard */}
          <RewardsWidget rewards={rewards} />
        </div>

        {/* Center column - Goals */}
        <div className="h-full">
          <GoalsWidget goals={goals} onNavigateToGoals={onNavigateToGoals} />
        </div>

        {/* Right column - Today's Schedule */}
        <div className="h-full">
          <TodayEventsWidget events={events} onViewCalendar={onNavigateToCalendar} />
        </div>
      </div>
    </div>
  );
});
FamilyDashboard.displayName = 'FamilyDashboard';

export default FamilyDashboard;
