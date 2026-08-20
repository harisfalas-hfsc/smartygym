import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { peekOffline } from "@/lib/offline";

export interface ActivityLog {
  id: string;
  user_id: string;
  content_type: 'workout' | 'program' | 'personal_training' | 'tool' | 'measurement' | 'checkin';
  item_id: string;
  item_name: string;
  action_type: 'viewed' | 'completed' | 'calculated' | 'program_started' | 'program_day_completed' | 'pt_started' | 'pt_day_completed' | 'program_day_viewed' | 'pt_day_viewed' | 'missed' | 'recorded';
  program_week?: number;
  program_day?: number;
  total_weeks?: number;
  total_days_per_week?: number;
  tool_input?: any;
  tool_result?: any;
  created_at: string;
  activity_date: string;
}

export interface LogActivityParams {
  content_type: ActivityLog['content_type'];
  item_id: string;
  item_name: string;
  action_type: ActivityLog['action_type'];
  program_week?: number;
  program_day?: number;
  total_weeks?: number;
  total_days_per_week?: number;
  tool_input?: any;
  tool_result?: any;
}

export const useActivityLog = (userId: string | undefined, filterType?: string, startDate?: Date, endDate?: Date) => {
  const queryClient = useQueryClient();
  const queryKey = ['activity-log', userId, filterType, startDate, endDate] as const;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void peekOffline<ActivityLog[]>('progress:activity-log', userId).then((cached) => {
      if (!active || !cached) return;
      const filtered = cached.filter((activity) => {
        if (filterType && filterType !== 'all' && activity.content_type !== filterType) return false;
        const activityTime = new Date(`${activity.activity_date}T00:00:00`).getTime();
        if (startDate && activityTime < new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime()) return false;
        if (endDate && activityTime > new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime()) return false;
        return true;
      });
      queryClient.setQueryData(queryKey, filtered);
    });
    return () => {
      active = false;
    };
  }, [userId, filterType, startDate, endDate, queryClient]);

  // Fetch activities
  const { data: activities = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from('user_activity_log')
        .select('*')
        .eq('user_id', userId)
        .order('activity_date', { ascending: false })
        .order('created_at', { ascending: false });

      // Apply content type filter
      if (filterType && filterType !== 'all') {
        query = query.eq('content_type', filterType);
      }

      // Apply date range filter
    if (startDate) {
      const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      query = query.gte('activity_date', startDateStr);
    }
    if (endDate) {
      const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      query = query.lte('activity_date', endDateStr);
    }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching activity log:', error);
        throw error;
      }

      return data as ActivityLog[];
    },
    enabled: !!userId,
  });

  // Log activity mutation
  const logActivity = useMutation({
    mutationFn: async (params: LogActivityParams) => {
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('user_activity_log')
        .insert({
          user_id: userId,
          ...params,
          activity_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: (error) => {
      console.error('Error logging activity:', error);
      toast.error('Failed to log activity');
    },
  });

  return {
    activities,
    isLoading,
    logActivity: logActivity.mutate,
  };
};

// Helper function to get activities by date
export const useActivitiesByDate = (userId: string | undefined, filterType?: string) => {
  const { activities, isLoading } = useActivityLog(userId, filterType);

  const activitiesByDate = activities.reduce((acc, activity) => {
    const date = activity.activity_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, ActivityLog[]>);

  return { activitiesByDate, isLoading };
};

// Helper function to get activity statistics
export const useActivityStats = (userId: string | undefined) => {
  const { activities, isLoading } = useActivityLog(userId);

    const stats = {
      workoutsThisMonth: 0,
      programDaysThisMonth: 0,
      toolCalculationsThisMonth: 0,
      totalActivities: activities.length,
      currentStreak: 0,
    };

  if (activities.length === 0) return { stats, isLoading };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  activities.forEach(activity => {
    const activityDate = new Date(activity.activity_date);
    if (activityDate >= startOfMonth) {
      if (activity.content_type === 'workout' && activity.action_type === 'completed') {
        stats.workoutsThisMonth++;
      }
      if (activity.content_type === 'program' && activity.action_type === 'program_day_completed') {
        stats.programDaysThisMonth++;
      }
      
      if (activity.content_type === 'tool' && activity.action_type === 'calculated') {
        stats.toolCalculationsThisMonth++;
      }
    }
  });

  // Calculate current streak
  const uniqueDates = [...new Set(activities.map(a => a.activity_date))].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  
  for (let i = 0; i < uniqueDates.length; i++) {
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - i);
    const expectedDateStr = expectedDate.toISOString().split('T')[0];
    
    if (uniqueDates[i] === expectedDateStr) {
      streak++;
    } else {
      break;
    }
  }
  
  stats.currentStreak = streak;

  return { stats, isLoading };
};

// Helper function to get month range
const getMonthRange = (monthsAgo: number) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
  return { start, end };
};

// Helper function to calculate percentage change
const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

// Month-over-month comparison hook
export const useActivityComparison = (userId: string | undefined) => {
  const thisMonthRange = getMonthRange(0);
  const lastMonthRange = getMonthRange(1);

  const { activities: thisMonthActivities, isLoading: thisMonthLoading } = useActivityLog(
    userId,
    undefined,
    thisMonthRange.start,
    thisMonthRange.end
  );

  const { activities: lastMonthActivities, isLoading: lastMonthLoading } = useActivityLog(
    userId,
    undefined,
    lastMonthRange.start,
    lastMonthRange.end
  );

  const calculateStats = (activities: ActivityLog[]) => {
    const stats = {
      workoutsCompleted: 0,
      programDaysCompleted: 0,
      toolCalculations: 0,
      totalActivities: activities.length,
      currentStreak: 0,
    };

    activities.forEach(activity => {
      if (activity.content_type === 'workout' && activity.action_type === 'completed') {
        stats.workoutsCompleted++;
      }
      if (activity.content_type === 'program' && activity.action_type === 'program_day_completed') {
        stats.programDaysCompleted++;
      }
      if (activity.content_type === 'tool' && activity.action_type === 'calculated') {
        stats.toolCalculations++;
      }
    });

    // Calculate streak for this month
    const uniqueDates = [...new Set(activities.map(a => a.activity_date))].sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < uniqueDates.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      const expectedDateStr = expectedDate.toISOString().split('T')[0];
      
      if (uniqueDates[i] === expectedDateStr) {
        streak++;
      } else {
        break;
      }
    }
    
    stats.currentStreak = streak;

    return stats;
  };

  const thisMonth = calculateStats(thisMonthActivities);
  const lastMonth = calculateStats(lastMonthActivities);

  const changes = {
    workoutsCompleted: calculatePercentageChange(thisMonth.workoutsCompleted, lastMonth.workoutsCompleted),
    programDaysCompleted: calculatePercentageChange(thisMonth.programDaysCompleted, lastMonth.programDaysCompleted),
    toolCalculations: calculatePercentageChange(thisMonth.toolCalculations, lastMonth.toolCalculations),
    totalActivities: calculatePercentageChange(thisMonth.totalActivities, lastMonth.totalActivities),
    currentStreak: calculatePercentageChange(thisMonth.currentStreak, lastMonth.currentStreak),
  };

  return {
    stats: { thisMonth, lastMonth, changes },
    isLoading: thisMonthLoading || lastMonthLoading,
  };
};
