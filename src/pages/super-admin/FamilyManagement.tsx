import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Eye, Calendar, CheckSquare, List as ListIcon, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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

export default function FamilyManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);

  const { data: families, isLoading } = useQuery({
    queryKey: ['super-admin-families'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('super_admin_family_stats')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as FamilyStats[];
    }
  });

  const filteredFamilies = families?.filter(family =>
    family.family_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeFamilies = filteredFamilies?.filter(f => f.status !== 'archived');
  const archivedFamilies = filteredFamilies?.filter(f => f.status === 'archived');

  const getPlanBadgeColor = (planName: string | null, isCustom: boolean) => {
    if (isCustom) return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    if (!planName) return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    if (planName === 'Free') return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    if (planName === 'Basic') return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (planName === 'Premium') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Family Management</h2>
            <p className="text-muted-foreground">View and manage all families</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search families..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Active Families */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
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
        ) : (
          <>
            {activeFamilies && activeFamilies.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-foreground">Active Families</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeFamilies.map((family) => (
              <Card key={family.family_id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{family.family_name}</CardTitle>
                      <CardDescription className="mt-1">
                        Created {formatDistanceToNow(new Date(family.created_at), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={getPlanBadgeColor(family.plan_name, family.is_custom_plan)}>
                      {family.is_custom_plan ? 'Custom' : family.plan_name || 'No Plan'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground font-medium">{family.member_count}</span>
                    <span className="text-muted-foreground">
                      members ({family.active_members} active)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="space-y-1">
                      <CheckSquare className="w-4 h-4 mx-auto text-muted-foreground" />
                      <div className="font-medium text-foreground">{family.task_count}</div>
                      <div className="text-xs text-muted-foreground">Tasks</div>
                    </div>
                    <div className="space-y-1">
                      <Calendar className="w-4 h-4 mx-auto text-muted-foreground" />
                      <div className="font-medium text-foreground">{family.event_count}</div>
                      <div className="text-xs text-muted-foreground">Events</div>
                    </div>
                    <div className="space-y-1">
                      <ListIcon className="w-4 h-4 mx-auto text-muted-foreground" />
                      <div className="font-medium text-foreground">{family.list_count}</div>
                      <div className="text-xs text-muted-foreground">Lists</div>
                    </div>
                  </div>

                  {family.last_activity && (
                    <div className="text-xs text-muted-foreground">
                      Last activity: {formatDistanceToNow(new Date(family.last_activity), { addSuffix: true })}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedFamilyId(family.family_id)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </CardContent>
              </Card>
                  ))}
                </div>
              </div>
            )}

            {archivedFamilies && archivedFamilies.length > 0 && (
              <div className="space-y-4 mt-8">
                <h3 className="text-xl font-semibold text-muted-foreground">Archived Families</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
                  {archivedFamilies.map((family) => (
                    <Card key={family.family_id} className="hover:shadow-lg transition-shadow border-dashed">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{family.family_name}</CardTitle>
                            <CardDescription className="mt-1">
                              Created {formatDistanceToNow(new Date(family.created_at), { addSuffix: true })}
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="bg-muted">
                            Archived
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground font-medium">{family.member_count}</span>
                          <span className="text-muted-foreground">members</span>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setSelectedFamilyId(family.family_id)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!isLoading && filteredFamilies?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No families found</p>
            </CardContent>
          </Card>
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
