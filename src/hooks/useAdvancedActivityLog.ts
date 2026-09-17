import { useActivityLog } from "./useActivityLog";
import { useWorkoutInteractions } from "./useWorkoutInteractions";
import { useProgramInteractions } from "./useProgramInteractions";
import { useMemo } from "react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, format } from "date-fns";

const CHART_COLORS = {
  workout: 'hsl(217, 91%, 60%)',
  program: 'hsl(142, 76%, 36%)',
  tool: 'hsl(24, 95%, 53%)',
  measurement: 'hsl(280, 100%, 70%)',
  
  checkin: 'hsl(172, 66%, 50%)',
  completed: 'hsl(142, 76%, 36%)',
  viewed: 'hsl(217, 91%, 60%)',
  favorites: 'hsl(45, 93%, 47%)',
  rated: 'hsl(280, 100%, 70%)',
  ongoing: 'hsl(24, 95%, 53%)',
  '1RM': 'hsl(217, 91%, 60%)',
  'BMR': 'hsl(142, 76%, 36%)',
  'Macro': 'hsl(24, 95%, 53%)',
  'weight': 'hsl(280, 100%, 70%)',
  'body_fat': 'hsl(340, 75%, 55%)',
  'measurements': 'hsl(45, 93%, 47%)',
  'morning_checkin': 'hsl(172, 66%, 50%)',
  'night_checkin': 'hsl(172, 66%, 40%)',
};

export const useAdvancedActivityLog = (
  userId: string | undefined,
  primaryFilter: string,
  secondaryFilter: string,
  timeFilter: 'last_month' | 'last_12_months' | 'last_6_months' | 'custom',
  customStartDate?: Date,
  customEndDate?: Date
) => {
  // Determine date range
  const { startDate, endDate} = useMemo(() => {
    const now = new Date();
    
    if (timeFilter === 'custom' && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate };
    }
    
    const start = new Date(now);
    if (timeFilter === 'last_month') {
      start.setMonth(start.getMonth() - 1);
    } else if (timeFilter === 'last_12_months') {
      start.setMonth(start.getMonth() - 12);
    } else {
      // last_6_months (default)
      start.setMonth(start.getMonth() - 6);
    }
    
    return { startDate: start, endDate: now };
  }, [timeFilter, customStartDate, customEndDate]);

  // Fetch data
  const { activities, isLoading: activitiesLoading } = useActivityLog(
    userId,
    primaryFilter === 'all' ? undefined : primaryFilter,
    startDate,
    endDate
  );

  const { data: workoutInteractions = [], isLoading: workoutsLoading } = useWorkoutInteractions(userId);
  const { data: programInteractions = [], isLoading: programsLoading } = useProgramInteractions(userId);

  const isLoading = activitiesLoading || workoutsLoading || programsLoading;

  // Process data
  const { lineChartData, pieChartData } = useMemo(() => {
    if (!activities || activities.length === 0) {
      return { lineChartData: [], pieChartData: [] };
    }

    // Filter activities based on secondary filter
    let filteredActivities = [...activities];

    // Apply secondary filters
    if (primaryFilter === 'workout' && secondaryFilter !== 'all') {
      const workoutIds = workoutInteractions
        .filter(interaction => {
          if (secondaryFilter === 'favorites') return interaction.is_favorite;
          if (secondaryFilter === 'viewed') return interaction.has_viewed;
          if (secondaryFilter === 'completed') return interaction.is_completed;
          if (secondaryFilter === 'rated') return interaction.rating !== null;
          return true;
        })
        .map(w => w.workout_id);
      
      filteredActivities = filteredActivities.filter(a => workoutIds.includes(a.item_id));
    }

    if (primaryFilter === 'program' && secondaryFilter !== 'all') {
      const programIds = programInteractions
        .filter(interaction => {
          if (secondaryFilter === 'favorites') return interaction.is_favorite;
          if (secondaryFilter === 'viewed') return interaction.has_viewed;
          if (secondaryFilter === 'ongoing') return interaction.is_ongoing;
          if (secondaryFilter === 'completed') return interaction.is_completed;
          if (secondaryFilter === 'rated') return interaction.rating !== null;
          return true;
        })
        .map(p => p.program_id);
      
      filteredActivities = filteredActivities.filter(a => programIds.includes(a.item_id));
    }

    if (primaryFilter === 'tool' && secondaryFilter !== 'all') {
      filteredActivities = filteredActivities.filter(a => 
        a.item_name?.toLowerCase().includes(secondaryFilter.toLowerCase())
      );
    }

    if (primaryFilter === 'measurement' && secondaryFilter !== 'all') {
      filteredActivities = filteredActivities.filter(a => {
        const input = (a.tool_result ?? a.tool_input) as any;
        if (secondaryFilter === 'weight') return input?.weight !== undefined && input?.weight !== null;
        if (secondaryFilter === 'body_fat') return input?.body_fat !== undefined && input?.body_fat !== null;
        if (secondaryFilter === 'measurements') {
          return ['chest', 'waist', 'hips', 'arms', 'thighs', 'neck', 'shoulders', 'calves']
            .some(k => input?.[k] !== undefined && input?.[k] !== null);
        }
        return true;
      });
    }

    if (primaryFilter === 'checkin' && secondaryFilter !== 'all') {
      filteredActivities = filteredActivities.filter(a =>
        (a.item_name || '').toLowerCase().includes(secondaryFilter.toLowerCase())
      );
    }

    // Generate time buckets based on time filter
    const timeBuckets: { [key: string]: any } = {};
    
    // Determine bucket count and type
    const getTimeBucketCount = () => {
      if (timeFilter === 'last_month') return 4; // 4 weeks
      if (timeFilter === 'last_12_months') return 12; // 12 months
      if (timeFilter === 'last_6_months') return 6; // 6 months
      if (timeFilter === 'custom') {
        const months = Math.ceil((endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
        return Math.max(1, Math.min(12, months));
      }
      return 6;
    };

    const bucketCount = getTimeBucketCount();
    const isWeekly = timeFilter === 'last_month';

    if (isWeekly) {
      // Generate weeks for last month
      for (let i = bucketCount - 1; i >= 0; i--) {
        const weekStart = new Date(endDate);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const key = `Week ${format(weekStart, 'MM/dd')}`;
        timeBuckets[key] = { name: key, start: weekStart, end: weekEnd };
      }
    } else {
      // Generate months for longer periods
      for (let i = bucketCount - 1; i >= 0; i--) {
        const monthStart = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
        const monthEnd = endOfMonth(monthStart);
        const key = format(monthStart, 'MMM yyyy');
        timeBuckets[key] = { name: key, start: monthStart, end: monthEnd };
      }
    }

    // Group activities by time bucket and type
    const lineData: any[] = [];
    const pieData: { [key: string]: number } = {};

    Object.entries(timeBuckets).forEach(([key, bucket]) => {
      const bucketActivities = filteredActivities.filter(activity => {
        const activityDate = new Date(activity.activity_date);
        return isWithinInterval(activityDate, { start: bucket.start, end: bucket.end });
      });

      const dataPoint: any = { name: bucket.name };

      if (primaryFilter === 'all') {
        // Count by content type
        const counts = bucketActivities.reduce((acc, activity) => {
          const type = activity.content_type;
          acc[type] = (acc[type] || 0) + 1;
          pieData[type] = (pieData[type] || 0) + 1;
          return acc;
        }, {} as { [key: string]: number });

        dataPoint['Workouts'] = counts.workout || 0;
        dataPoint['Programs'] = counts.program || 0;
        dataPoint['Tools'] = counts.tool || 0;
        dataPoint['Measurements'] = counts.measurement || 0;
        dataPoint['Check-ins'] = counts.checkin || 0;
      } else {
        // Count activities for this bucket
        dataPoint['Count'] = bucketActivities.length;
        
        // For pie chart, break down by specific categories
        if (primaryFilter === 'workout') {
          bucketActivities.forEach(activity => {
            const category = activity.item_name || 'Other';
            pieData[category] = (pieData[category] || 0) + 1;
          });
        } else if (primaryFilter === 'program') {
          bucketActivities.forEach(activity => {
            const category = activity.item_name || 'Other';
            pieData[category] = (pieData[category] || 0) + 1;
          });
        } else if (primaryFilter === 'tool') {
          bucketActivities.forEach(activity => {
            const toolName = activity.item_name?.includes('1RM') ? '1RM' :
                            activity.item_name?.includes('BMR') ? 'BMR' :
                            activity.item_name?.includes('Macro') ? 'Macro' : 'Other';
            pieData[toolName] = (pieData[toolName] || 0) + 1;
          });
        } else if (primaryFilter === 'measurement') {
          bucketActivities.forEach(activity => {
            const input = (activity.tool_result ?? activity.tool_input) as any;
            const has = (k: string) => input?.[k] !== undefined && input?.[k] !== null;
            if (has('weight')) pieData['Weight'] = (pieData['Weight'] || 0) + 1;
            if (has('body_fat')) pieData['Body Fat %'] = (pieData['Body Fat %'] || 0) + 1;
            if (['chest', 'waist', 'hips', 'arms', 'thighs', 'neck', 'shoulders', 'calves'].some(has)) {
              pieData['Body Measurements'] = (pieData['Body Measurements'] || 0) + 1;
            }
          });
        } else if (primaryFilter === 'checkin') {
          bucketActivities.forEach(activity => {
            const name = (activity.item_name || '').toLowerCase().includes('night')
              ? 'Night Check-in'
              : 'Morning Check-in';
            pieData[name] = (pieData[name] || 0) + 1;
          });
        }
      }

      lineData.push(dataPoint);
    });

    // Format pie chart data
    const pieChartFormatted = Object.entries(pieData).map(([name, value]) => {
      const colorKey = name.toLowerCase().replace(/ /g, '_');
      return {
        name,
        value,
        color: CHART_COLORS[colorKey as keyof typeof CHART_COLORS] || CHART_COLORS.workout,
        total: Object.values(pieData).reduce((a, b) => a + b, 0),
      };
    }).sort((a, b) => b.value - a.value);

    return { lineChartData: lineData, pieChartData: pieChartFormatted };
  }, [activities, primaryFilter, secondaryFilter, timeFilter, workoutInteractions, programInteractions, startDate, endDate]);

  return { lineChartData, pieChartData, isLoading };
};
