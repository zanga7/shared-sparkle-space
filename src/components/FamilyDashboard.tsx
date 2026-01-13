import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { useMemberColor } from '@/hooks/useMemberColor';
import { useEvents } from '@/hooks/useEvents';
import { useRewards } from '@/hooks/useRewards';
import { Profile, Task } from '@/types/task';
import { 
  CheckSquare, 
  Calendar, 
  Trophy,
  Sparkles,
  Clock,
  Gift
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { motion } from 'framer-motion';

interface FamilyDashboardProps {
  familyMembers: Profile[];
  tasks: Task[];
  familyId: string;
  onNavigateToTasks: () => void;
  onNavigateToCalendar?: () => void;
  onMemberSelect: (memberId: string) => void;
}

// Member card component with split layout - avatar left, stats right
const MemberStatCard = ({ 
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
        style={{ backgroundColor: hex }}
        onClick={onViewDashboard}
      >
        <div className="flex">
          {/* Left column - Avatar and Name (25% width, white background) */}
          <div className="w-1/4 bg-white flex flex-col items-center justify-center p-3">
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

          {/* Right column - Stats (75% width, colored background) */}
          <div className="w-3/4 relative">
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
};

// Today's events widget
const TodayEventsWidget = ({ events, onViewCalendar }: { events: any[]; onViewCalendar?: () => void }) => {
  const today = startOfDay(new Date());
  const todayEnd = endOfDay(today);
  
  const todayEvents = events
    .filter(event => {
      const eventDate = new Date(event.start_date);
      return eventDate >= today && eventDate <= todayEnd;
    })
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  return (
    <Card className="h-full">
      <CardHeader className="pb-3 pt-0">
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
      </CardHeader>
      <CardContent>
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
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {event.is_all_day ? 'All day' : format(new Date(event.start_date), 'h:mm a')}
                    {event.location && ` • ${event.location}`}
                  </p>
                </div>
                {event.attendees && event.attendees.length > 0 && (
                  <div className="flex -space-x-2">
                    {event.attendees.slice(0, 3).map((attendee: any) => (
                      <UserAvatar
                        key={attendee.profile_id}
                        name={attendee.profile?.display_name || 'Unknown'}
                        color={attendee.profile?.color}
                        avatarIcon={attendee.profile?.avatar_url || undefined}
                        size="sm"
                        className="border-2 border-background"
                      />
                    ))}
                    {event.attendees.length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                        +{event.attendees.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Rewards widget
const RewardsWidget = ({ rewards }: { rewards: any[] }) => {
  const activeRewards = rewards.filter(r => r.is_active);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3 pt-0">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Gift className="h-5 w-5 text-primary" />
          Available Rewards
        </h2>
      </CardHeader>
      <CardContent>
        {activeRewards.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Gift className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No rewards available</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {activeRewards.slice(0, 6).map((reward, index) => (
              <motion.div
                key={reward.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                    {reward.image_url ? (
                      <img 
                        src={reward.image_url} 
                        alt={reward.title}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <Gift className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{reward.title}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {reward.reward_type.replace('_', ' ')}
                  </p>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Trophy className="h-3 w-3 text-amber-500" />
                  {reward.cost_points}
                </Badge>
              </motion.div>
            ))}
            {activeRewards.length > 6 && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                +{activeRewards.length - 6} more rewards
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const FamilyDashboard = ({
  familyMembers,
  tasks,
  familyId,
  onNavigateToTasks,
  onNavigateToCalendar,
  onMemberSelect
}: FamilyDashboardProps) => {
  const { events = [] } = useEvents(familyId);
  const { rewards = [] } = useRewards();
  
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
        className="text-center mb-8"
      >
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 flex items-center justify-center gap-2">
          <Sparkles className="h-8 w-8 text-amber-500" />
          Family Dashboard
          <Sparkles className="h-8 w-8 text-amber-500" />
        </h1>
        <p className="text-muted-foreground">
          {format(new Date(), 'EEEE, MMMM do, yyyy')}
        </p>
      </motion.div>

      {/* Main content grid - 3 columns with aligned headers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column - Family Members (sorted by points) */}
        <div className="space-y-4">
          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="pb-3 pt-0 px-0">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <Trophy className="h-5 w-5 text-primary" />
                  Family Members
                </h2>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onNavigateToTasks}
                  className="gap-2"
                >
                  <CheckSquare className="h-4 w-4" />
                  Tasks Dashboard
                </Button>
              </div>
            </CardHeader>
          </Card>
          
          <div className="space-y-4">
            {sortedMemberStats.map((stat, index) => (
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

        {/* Center column - Today's Schedule */}
        <div>
          <TodayEventsWidget events={events} onViewCalendar={onNavigateToCalendar} />
        </div>

        {/* Right column - Rewards */}
        <div>
          <RewardsWidget rewards={rewards} />
        </div>
      </div>
    </div>
  );
};

export default FamilyDashboard;
