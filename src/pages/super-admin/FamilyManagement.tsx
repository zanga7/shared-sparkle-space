import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, Eye, Calendar, CheckSquare, List as ListIcon, Users, 
  ChevronLeft, ChevronRight, ArrowUpDown, Filter, RefreshCw,
  TrendingUp, UserPlus, Activity
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { FamilyDetailModal } from '@/components/super-admin/FamilyDetailModal';

interface FamilyStats {
  family_id: string;
  family_name: string;
  created_at: string;
  current_plan_id: string | null;
  plan_name: string | null;
  is_custom_plan: boolean;
  member_count: number;
  active_members: number;
  last_activity: string | null;
  max_streak: number;
  task_count: number;
  event_count: number;
  list_count: number;
  reward_count: number;
  status: string;
}

type SortField = 'created_at' | 'family_name' | 'member_count' | 'last_activity' | 'task_count';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48, 96];

export default function FamilyManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  const { data: families, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['super-admin-families'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('super_admin_family_stats')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as FamilyStats[];
    },
    staleTime: 30000, // 30 seconds
  });

  // Get unique plan names for filter
  const planOptions = useMemo(() => {
    if (!families) return [];
    const plans = new Set(families.map(f => f.plan_name || 'No Plan'));
    return Array.from(plans).sort();
  }, [families]);

  // Filter and sort families
  const processedFamilies = useMemo(() => {
    if (!families) return [];
    
    let result = [...families];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(family =>
        family.family_name.toLowerCase().includes(query) ||
        family.family_id.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(family => 
        statusFilter === 'archived' ? family.status === 'archived' : family.status !== 'archived'
      );
    }
    
    // Apply plan filter
    if (planFilter !== 'all') {
      result = result.filter(family => 
        (family.plan_name || 'No Plan') === planFilter
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'family_name':
          aVal = a.family_name.toLowerCase();
          bVal = b.family_name.toLowerCase();
          break;
        case 'member_count':
          aVal = a.member_count;
          bVal = b.member_count;
          break;
        case 'last_activity':
          aVal = a.last_activity ? new Date(a.last_activity).getTime() : 0;
          bVal = b.last_activity ? new Date(b.last_activity).getTime() : 0;
          break;
        case 'task_count':
          aVal = a.task_count;
          bVal = b.task_count;
          break;
        default:
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
      }
      
      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });
    
    return result;
  }, [families, searchQuery, statusFilter, planFilter, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(processedFamilies.length / itemsPerPage);
  const paginatedFamilies = processedFamilies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  // Stats summary
  const stats = useMemo(() => {
    if (!families) return null;
    const activeFamilies = families.filter(f => f.status !== 'archived');
    const totalMembers = families.reduce((sum, f) => sum + f.member_count, 0);
    const activeMembers = families.reduce((sum, f) => sum + f.active_members, 0);
    const recentFamilies = families.filter(f => {
      const created = new Date(f.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return created > weekAgo;
    });
    
    return {
      total: families.length,
      active: activeFamilies.length,
      archived: families.length - activeFamilies.length,
      totalMembers,
      activeMembers,
      newThisWeek: recentFamilies.length,
    };
  }, [families]);

  const getPlanBadgeColor = (planName: string | null, isCustom: boolean) => {
    if (isCustom) return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    if (!planName) return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    if (planName === 'Free') return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    if (planName === 'Basic') return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (planName === 'Premium') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header with Stats */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Family Management</h2>
            <p className="text-muted-foreground">
              {stats ? `${stats.total} families, ${stats.totalMembers} total members` : 'Loading...'}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Families</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.newThisWeek}</p>
                  <p className="text-xs text-muted-foreground">New This Week</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalMembers}</p>
                  <p className="text-xs text-muted-foreground">Total Members</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.activeMembers}</p>
                  <p className="text-xs text-muted-foreground">Active Members</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{processedFamilies.length}</p>
                  <p className="text-xs text-muted-foreground">Filtered Results</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); handleFilterChange(); }}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={(v: any) => { setStatusFilter(v); handleFilterChange(); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); handleFilterChange(); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              {planOptions.map(plan => (
                <SelectItem key={plan} value={plan}>{plan}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortField} onValueChange={(v: SortField) => setSortField(v)}>
            <SelectTrigger className="w-[160px]">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Date Created</SelectItem>
              <SelectItem value="family_name">Name</SelectItem>
              <SelectItem value="member_count">Members</SelectItem>
              <SelectItem value="last_activity">Last Activity</SelectItem>
              <SelectItem value="task_count">Tasks</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            <ArrowUpDown className={`w-4 h-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* Results Info & Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, processedFamilies.length)} of {processedFamilies.length} families
          </p>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Per page:</span>
            <Select 
              value={itemsPerPage.toString()} 
              onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}
            >
              <SelectTrigger className="w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEMS_PER_PAGE_OPTIONS.map(n => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Family Cards Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: itemsPerPage }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded" />
                    <div className="h-3 bg-muted rounded w-5/6" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : paginatedFamilies.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedFamilies.map((family) => (
              <Card 
                key={family.family_id} 
                className={`hover:shadow-lg transition-shadow cursor-pointer ${
                  family.status === 'archived' ? 'opacity-60 border-dashed' : ''
                }`}
                onClick={() => setSelectedFamilyId(family.family_id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{family.family_name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {format(new Date(family.created_at), 'MMM d, yyyy')}
                      </CardDescription>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs shrink-0 ${getPlanBadgeColor(family.plan_name, family.is_custom_plan)}`}
                    >
                      {family.is_custom_plan ? 'Custom' : family.plan_name || 'Free'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium">{family.member_count}</span>
                      <span className="text-muted-foreground text-xs">
                        ({family.active_members} active)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-center text-xs">
                    <div className="bg-muted/50 rounded p-1.5">
                      <div className="font-semibold">{family.task_count}</div>
                      <div className="text-muted-foreground">Tasks</div>
                    </div>
                    <div className="bg-muted/50 rounded p-1.5">
                      <div className="font-semibold">{family.event_count}</div>
                      <div className="text-muted-foreground">Events</div>
                    </div>
                    <div className="bg-muted/50 rounded p-1.5">
                      <div className="font-semibold">{family.list_count}</div>
                      <div className="text-muted-foreground">Lists</div>
                    </div>
                  </div>

                  {family.last_activity && (
                    <div className="text-xs text-muted-foreground pt-1 border-t">
                      Active {formatDistanceToNow(new Date(family.last_activity), { addSuffix: true })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No families found matching your filters</p>
              <Button 
                variant="link" 
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setPlanFilter('all');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center gap-1">
              {/* Show page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </Button>
          </div>
        )}
      </div>

      {selectedFamilyId && (
        <FamilyDetailModal
          familyId={selectedFamilyId}
          open={!!selectedFamilyId}
          onOpenChange={(open) => !open && setSelectedFamilyId(null)}
        />
      )}
    </>
  );
}
