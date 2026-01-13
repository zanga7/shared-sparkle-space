import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useMemberColor } from '@/hooks/useMemberColor';
import { useEvents } from '@/hooks/useEvents';
import { Profile, Task } from '@/types/task';
import { 
  CheckSquare, 
  Calendar, 
  Trophy,
  ArrowRight,
  Sparkles,
  Clock,
  Star,
  TrendingUp
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { motion } from 'framer-motion';

interface FamilyDashboardProps {
  familyMembers: Profile[];
  tasks: Task[];
  familyId: string;
  onNavigateToTasks: () => void;
  onMemberSelect: (memberId: string) => void;
}

// Member card component with dynamic stats
const MemberStatCard = ({ 
  member, 
  todayTaskCount, 
  completedCount,
  onViewDashboard 
}: { 
  member: Profile; 
  todayTaskCount: number;
  completedCount: number;
  onViewDashboard: () => void;
}) => {
  const { hex, styles: colorStyles } = useMemberColor(member.color);
  const pendingCount = todayTaskCount - completedCount;
  const progressPercent = todayTaskCount > 0 ? (completedCount / todayTaskCount) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className="relative overflow-hidden cursor-pointer group transition-all duration-300 hover:shadow-xl border-2"
        style={{ borderColor: `${hex}40` }}
        onClick={onViewDashboard}
      >
        {/* Gradient background accent */}
        <div 
          className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity"
          style={{ background: `linear-gradient(135deg, ${hex}, transparent)` }}
        />
        
        <CardContent className="p-4 sm:p-6 relative">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <UserAvatar 
                  name={member.display_name} 
                  color={member.color}
                  avatarIcon={member.avatar_url || undefined}
                  size="lg"
                />
                {progressPercent === 100 && todayTaskCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5">
                    <Star className="h-3 w-3 text-white fill-white" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg">{member.display_name}</h3>
                <Badge variant="outline" className="text-xs capitalize">
                  {member.role}
                </Badge>
              </div>
            </div>
            
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="text-2xl font-bold" style={{ color: hex }}>
                  {member.total_points}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">points</span>
            </div>
          </div>
          
          {/* Task progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Today's Tasks</span>
              <span className="font-medium">{completedCount}/{todayTaskCount}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div 
                className="h-full rounded-full"
                style={{ backgroundColor: hex }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
            </div>
          </div>
          
          {/* Quick action */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {pendingCount > 0 ? `${pendingCount} pending` : 'All done! 🎉'}
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Today's events widget
const TodayEventsWidget = ({ events, familyId }: { events: any[]; familyId: string }) => {
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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-primary" />
          Today's Schedule
        </CardTitle>
      </CardHeader>
      <CardContent>
        {todayEvents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No events scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
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

// Individual leaderboard row component to properly use hooks
const LeaderboardRow = ({ 
  member, 
  index, 
  topScore 
}: { 
  member: Profile; 
  index: number; 
  topScore: number;
}) => {
  const { hex } = useMemberColor(member.color);
  const barWidth = topScore > 0 ? (member.total_points / topScore) * 100 : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex items-center gap-3"
    >
      <span className="w-6 text-center font-bold text-muted-foreground">
        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
      </span>
      <UserAvatar 
        name={member.display_name} 
        color={member.color}
        avatarIcon={member.avatar_url || undefined}
        size="sm"
      />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">{member.display_name}</span>
          <span className="text-sm font-bold" style={{ color: hex }}>
            {member.total_points}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: hex }}
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
          />
        </div>
      </div>
    </motion.div>
  );
};

// Family leaderboard widget
const LeaderboardWidget = ({ members }: { members: Profile[] }) => {
  const sortedMembers = [...members].sort((a, b) => b.total_points - a.total_points);
  const topScore = sortedMembers[0]?.total_points || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Points Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedMembers.map((member, index) => (
            <LeaderboardRow
              key={member.id}
              member={member}
              index={index}
              topScore={topScore}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const FamilyDashboard = ({
  familyMembers,
  tasks,
  familyId,
  onNavigateToTasks,
  onMemberSelect
}: FamilyDashboardProps) => {
  const { events = [] } = useEvents(familyId);
  
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
        completedCount: completedTasks.length
      };
    });
  }, [familyMembers, tasks]);

  // Calculate total family stats
  const totalTasks = memberStats.reduce((sum, s) => sum + s.todayTaskCount, 0);
  const totalCompleted = memberStats.reduce((sum, s) => sum + s.completedCount, 0);
  const totalPoints = familyMembers.reduce((sum, m) => sum + m.total_points, 0);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header with family stats */}
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

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <CheckSquare className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-3xl font-bold">{totalCompleted}/{totalTasks}</p>
              <p className="text-sm text-muted-foreground">Tasks Today</p>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="p-4 text-center">
              <Trophy className="h-8 w-8 mx-auto mb-2 text-amber-500" />
              <p className="text-3xl font-bold">{totalPoints}</p>
              <p className="text-sm text-muted-foreground">Total Points</p>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-3xl font-bold">{familyMembers.length}</p>
              <p className="text-sm text-muted-foreground">Family Members</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Member cards - takes 2 columns on large screens */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Family Members</h2>
            <Button 
              variant="outline" 
              size="sm"
              onClick={onNavigateToTasks}
              className="gap-2"
            >
              <CheckSquare className="h-4 w-4" />
              View All Tasks
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {memberStats.map((stat, index) => (
              <MemberStatCard
                key={stat.member.id}
                member={stat.member}
                todayTaskCount={stat.todayTaskCount}
                completedCount={stat.completedCount}
                onViewDashboard={() => onMemberSelect(stat.member.id)}
              />
            ))}
          </div>
        </div>

        {/* Sidebar - Events and Leaderboard */}
        <div className="space-y-6">
          <TodayEventsWidget events={events} familyId={familyId} />
          <LeaderboardWidget members={familyMembers} />
        </div>
      </div>
    </div>
  );
};

export default FamilyDashboard;
