import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dumbbell, Calendar, User, Calculator, Scale, ClipboardCheck, CalendarClock, X, Play, Clock } from "lucide-react";
import { useActivityLog } from "@/hooks/useActivityLog";
import { format, isFuture, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface ScheduledWorkout {
  id: string;
  content_type: string;
  content_id: string;
  content_name: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  notes: string | null;
}

interface DailyActivityModalProps {
  date: Date;
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const DailyActivityModal = ({ date, isOpen, onClose, userId }: DailyActivityModalProps) => {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const { activities, isLoading } = useActivityLog(userId);
  const [scheduledItems, setScheduledItems] = useState<ScheduledWorkout[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const dayActivities = activities.filter(a => a.activity_date === dateStr);
  const isFutureDate = isFuture(date);
  const isTodayDate = isToday(date);

  useEffect(() => {
    const fetchScheduledWorkouts = async () => {
      try {
        const { data, error } = await supabase
          .from('scheduled_workouts')
          .select('*')
          .eq('user_id', userId)
          .eq('scheduled_date', dateStr)
          .order('scheduled_time', { ascending: true });

        if (error) throw error;
        setScheduledItems(data || []);
      } catch (error) {
        console.error('Error fetching scheduled workouts:', error);
      } finally {
        setLoadingScheduled(false);
      }
    };

    if (isOpen) {
      fetchScheduledWorkouts();
    }
  }, [userId, dateStr, isOpen]);

  const workouts = dayActivities.filter(a => a.content_type === 'workout' || (a.content_type as string) === 'custom_workout');
  const programs = dayActivities.filter(a => a.content_type === 'program');
  const personalTraining = dayActivities.filter(a => a.content_type === 'personal_training');
  const tools = dayActivities.filter(a => a.content_type === 'tool');
  const measurements = dayActivities.filter(a => a.content_type === 'measurement');
  const checkins = dayActivities.filter(a => a.content_type === 'checkin');

  const getBadgeVariant = (actionType: string): "default" | "secondary" | "outline" => {
    if (actionType.includes('completed')) return 'default';
    if (actionType.includes('viewed')) return 'secondary';
    return 'outline';
  };

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'viewed': 'Viewed',
      'completed': 'Completed',
      'calculated': 'Calculated',
      'program_started': '🔥 Started',
      'program_day_viewed': 'Day Viewed',
      'program_day_completed': 'Day Completed',
      'pt_started': '🔥 Started',
      'pt_day_viewed': 'Day Viewed',
      'pt_day_completed': 'Day Completed',
    };
    return labels[actionType] || actionType;
  };

  const handleCancelScheduled = async (id: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_workouts')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;

      setScheduledItems(prev => prev.filter(item => item.id !== id));
      toast({
        title: "Schedule Cancelled",
        description: "The scheduled workout has been removed.",
      });
    } catch (error) {
      console.error('Error cancelling scheduled workout:', error);
      toast({
        title: "Error",
        description: "Failed to cancel the scheduled workout.",
        variant: "destructive",
      });
    }
  };

  const handleStartWorkout = (item: ScheduledWorkout) => {
    const route = item.content_type === 'custom_workout'
      ? `/my-workouts/${item.content_id}`
      : item.content_type === 'workout'
        ? `/workout/${item.content_id}`
        : `/training-programs/${item.content_id}`;
    navigate(route);
    onClose();
  };

  const hasScheduledItems = scheduledItems.filter(s => s.status === 'scheduled').length > 0;
  const hasActivities = dayActivities.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isFutureDate ? 'Scheduled' : 'Activity Log'} - {format(date, 'MMMM d, yyyy')}
          </DialogTitle>
        </DialogHeader>

        {isLoading || loadingScheduled ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !hasScheduledItems && !hasActivities ? (
          <div className="text-center py-12 text-muted-foreground">
            {isFutureDate 
              ? "No workouts scheduled for this day" 
              : "No activities recorded for this day"
            }
          </div>
        ) : (
          <div className="space-y-6">
            {/* Scheduled Section - Show for today and future dates */}
            {hasScheduledItems && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-purple-500" />
                  {isTodayDate ? "Today's Schedule" : "Scheduled"} ({scheduledItems.filter(s => s.status === 'scheduled').length})
                </h3>
                <div className="space-y-2">
                  {scheduledItems
                    .filter(item => item.status === 'scheduled')
                    .map(item => (
                    <Card key={item.id} className="border-purple-500/30 bg-purple-500/5">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{item.content_name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {item.content_type === 'workout' ? 'Workout' : 'Program'}
                              </Badge>
                              {item.scheduled_time && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {item.scheduled_time}
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {(isTodayDate || !isFutureDate) && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleStartWorkout(item)}
                                className="gap-1"
                              >
                                <Play className="h-3 w-3" />
                                Start
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelScheduled(item.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Only show past activities for today and past dates */}
            {!isFutureDate && (
              <>
                {/* Workouts Section */}
                {workouts.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Dumbbell className="h-4 w-4 text-green-500" />
                      Workouts ({workouts.length})
                    </h3>
                    <div className="space-y-2">
                      {workouts.map(activity => (
                        <Card key={activity.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{activity.item_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(activity.created_at), 'h:mm a')}
                                </p>
                              </div>
                              <Badge variant={getBadgeVariant(activity.action_type)}>
                                {getActionLabel(activity.action_type)}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Programs Section */}
                {programs.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      Training Programs ({programs.length})
                    </h3>
                    <div className="space-y-2">
                      {programs.map(activity => (
                        <Card key={activity.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{activity.item_name}</p>
                                {activity.program_week && activity.program_day && (
                                  <p className="text-sm text-muted-foreground">
                                    Week {activity.program_week}, Day {activity.program_day}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(activity.created_at), 'h:mm a')}
                                </p>
                              </div>
                              <Badge variant={getBadgeVariant(activity.action_type)}>
                                {getActionLabel(activity.action_type)}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}


                {/* Tools Section */}
                {tools.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-orange-500" />
                      Calculator Tools ({tools.length})
                    </h3>
                    <div className="space-y-2">
                      {tools.map(activity => (
                        <Card key={activity.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium">{activity.item_name}</p>
                                {activity.tool_result && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Result: {typeof activity.tool_result === 'object' 
                                      ? Object.entries(activity.tool_result).map(([key, value]) => 
                                          `${key}: ${value}`
                                        ).join(', ')
                                      : activity.tool_result}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(activity.created_at), 'h:mm a')}
                                </p>
                              </div>
                              <Badge variant="outline" className="bg-orange-500/10">
                                Calculated
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Measurements Section */}
                {measurements.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-purple-500" />
                      Measurements ({measurements.length})
                    </h3>
                    <div className="space-y-2">
                      {measurements.map(activity => (
                        <Card key={activity.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium">Body Measurements</p>
                                <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                                  {activity.tool_result?.weight && (
                                    <p>Weight: {activity.tool_result.weight} kg</p>
                                  )}
                                  {activity.tool_result?.body_fat && (
                                    <p>Body Fat: {activity.tool_result.body_fat}%</p>
                                  )}
                                  {activity.tool_result?.muscle_mass && (
                                    <p>Muscle Mass: {activity.tool_result.muscle_mass} kg</p>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(activity.created_at), 'h:mm a')}
                                </p>
                              </div>
                              <Badge variant="outline">Recorded</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Check-ins Section */}
                {checkins.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-teal-500" />
                      Check-ins ({checkins.length})
                    </h3>
                    <div className="space-y-2">
                      {checkins.map(activity => (
                        <Card key={activity.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium">{activity.item_name}</p>
                                {activity.tool_result && (
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {activity.tool_result.score && (
                                      <p>Smarty Score: {activity.tool_result.score}</p>
                                    )}
                                    {activity.tool_result.category && (
                                      <p>Category: {activity.tool_result.category}</p>
                                    )}
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(activity.created_at), 'h:mm a')}
                                </p>
                              </div>
                              <Badge variant="default" className="bg-teal-500">Completed</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
