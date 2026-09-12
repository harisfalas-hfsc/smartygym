import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useActivitiesByDate } from "@/hooks/useActivityLog";
import { useCheckinScoresByDate } from "@/hooks/useCheckinScoresByDate";
import { useScheduledWorkouts } from "@/hooks/useScheduledWorkouts";
import { DailyActivityModal } from "./DailyActivityModal";
import { ScheduledListPanel } from "./ScheduledListPanel";

interface LogBookCalendarProps {
  userId: string;
  filter: string;
  onDayClick?: (date: Date) => void;
}

export const LogBookCalendar = ({ userId, filter }: LogBookCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { activitiesByDate, isLoading } = useActivitiesByDate(userId, filter);
  const { scoresByDate } = useCheckinScoresByDate(userId);
  const { scheduledByDate, isLoading: isLoadingScheduled } = useScheduledWorkouts(userId);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthName = monthNames[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  const getCheckinScore = (day: number) => {
    const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return scoresByDate[dateStr] || null;
  };

  const getScoreColor = (score: number | null): string => {
    if (score === null) return '';
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScheduledItems = (day: number) => {
    const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return scheduledByDate[dateStr] || [];
  };

  const getActivityBadges = (day: number) => {
    const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const activities = activitiesByDate[dateStr] || [];
    const scheduledItems = getScheduledItems(day);
    
    const badges = new Set<string>();
    
    // Add scheduled badge if there are scheduled items
    if (scheduledItems.length > 0) {
      badges.add('scheduled');
    }
    
    activities.forEach(activity => {
      const actionType = activity.action_type as string;
      if (activity.content_type === 'workout') {
        if (actionType === 'purchased') {
          badges.add('workout-purchased');
        } else {
          badges.add(actionType === 'completed' ? 'workout-completed' : 'workout-viewed');
        }
      } else if (activity.content_type === 'program') {
        if (actionType === 'purchased') {
          badges.add('program-purchased');
        } else if (actionType === 'program_started') {
          badges.add('program-ongoing');
        } else if (actionType === 'program_day_completed') {
          badges.add('program-completed');
        } else {
          badges.add('program-viewed');
        }
      } else if (activity.content_type === 'personal_training') {
        if (actionType === 'pt_started') {
          badges.add('pt-ongoing');
        } else if (actionType === 'pt_day_completed') {
          badges.add('pt-completed');
        } else {
          badges.add('pt-viewed');
        }
      } else if (activity.content_type === 'tool') {
        badges.add('tool');
      } else if (activity.content_type === 'measurement') {
        badges.add('measurement');
      } else if (activity.content_type === 'checkin') {
        badges.add('checkin');
      }
    });

    return Array.from(badges);
  };

  const getBadgeColor = (badge: string) => {
    const colors: Record<string, string> = {
      'scheduled': 'bg-purple-500',
      'workout-viewed': 'bg-slate-400',
      'workout-completed': 'bg-emerald-500',
      'workout-purchased': 'bg-amber-500',
      'program-viewed': 'bg-slate-400',
      'program-ongoing': 'bg-orange-500',
      'program-completed': 'bg-sky-500',
      'program-purchased': 'bg-amber-600',
      'pt-viewed': 'bg-slate-400',
      'pt-ongoing': 'bg-rose-400',
      'pt-completed': 'bg-violet-600',
      'tool': 'bg-fuchsia-500',
      'measurement': 'bg-indigo-500',
      'checkin': 'bg-cyan-500',
    };
    return colors[badge] || 'bg-slate-400';
  };

  const handleDayClick = (day: number) => {
    const date = new Date(year, currentDate.getMonth(), day);
    setSelectedDate(date);
  };

  if (isLoading || isLoadingScheduled) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="grid grid-cols-7 gap-2">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ScheduledListPanel userId={userId} />
      <Card>
        <CardContent className="p-3 sm:p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6 gap-1 sm:gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0 justify-center">
              {/* Month Selector */}
              <Select 
                value={String(currentDate.getMonth())} 
                onValueChange={(value) => {
                  setCurrentDate(new Date(currentDate.getFullYear(), parseInt(value), 1));
                }}
              >
                <SelectTrigger className="w-full max-w-[140px] min-w-0 h-9">
                  <SelectValue>{monthName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((month, index) => (
                    <SelectItem key={month} value={String(index)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Year Selector */}
              <Select 
                value={String(year)} 
                onValueChange={(value) => {
                  setCurrentDate(new Date(parseInt(value), currentDate.getMonth(), 1));
                }}
              >
                <SelectTrigger className="w-full max-w-[100px] min-w-0 h-9">
                  <SelectValue>{year}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => {
                    const yearOption = new Date().getFullYear() - 2 + i;
                    return (
                      <SelectItem key={yearOption} value={String(yearOption)}>
                        {yearOption}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs sm:text-sm font-medium text-muted-foreground p-1 sm:p-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Empty cells for days before month starts */}
            {[...Array(firstDay)].map((_, i) => (
              <div key={`empty-${i}`} className="p-1 sm:p-2" />
            ))}

            {/* Days of the month */}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1;
              const badges = getActivityBadges(day);
              const checkinData = getCheckinScore(day);
              const scheduledItems = getScheduledItems(day);
              const hasActivity = badges.length > 0 || checkinData !== null;
              const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              const isToday = todayStr === dateStr;
              const isFuture = new Date(dateStr) > today;

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`
                    relative p-1 sm:p-2 rounded-lg text-center transition-all min-w-0
                    ${hasActivity ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted'}
                    ${isToday ? 'ring-2 ring-primary' : ''}
                    ${isFuture && scheduledItems.length > 0 ? 'bg-purple-500/10' : ''}
                  `}
                >
                  <div className={`text-sm font-medium mb-1 ${isFuture ? 'text-muted-foreground' : ''}`}>{day}</div>
                  
                  {/* Check-in Score Indicator */}
                  {checkinData && checkinData.score !== null && (
                    <div className="flex justify-center mb-1">
                      <div 
                        className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded ${getScoreColor(checkinData.score)}`}
                        title={`Smarty Score: ${checkinData.score}`}
                      >
                        {checkinData.score}
                      </div>
                    </div>
                  )}
                  
                  {/* Activity Badges */}
                  {badges.length > 0 && (
                    <div className="flex gap-1 justify-center flex-wrap">
                      {badges.map((badge, idx) => (
                        <div
                          key={idx}
                          className={`w-2 h-2 rounded-full ${getBadgeColor(badge)}`}
                          title={badge === 'scheduled' ? `${scheduledItems.length} scheduled` : badge}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-medium mb-3">Legend</h3>
            
            {/* Smarty Score Legend */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Smarty Check-in Score</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="px-1.5 py-0.5 rounded bg-green-500 text-white text-[10px] font-bold">80+</div>
                  <span>Excellent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="px-1.5 py-0.5 rounded bg-yellow-500 text-white text-[10px] font-bold">60+</div>
                  <span>Good</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="px-1.5 py-0.5 rounded bg-orange-500 text-white text-[10px] font-bold">40+</div>
                  <span>Fair</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold">&lt;40</div>
                  <span>Needs Work</span>
                </div>
              </div>
            </div>
            
            {/* Activity Legend */}
            <p className="text-xs text-muted-foreground mb-2">Activity Indicators</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span>Scheduled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-400" />
                <span>Viewed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span>Workout Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span>Program Ongoing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-sky-500" />
                <span>Program Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <span>PT Ongoing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-violet-600" />
                <span>PT Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-fuchsia-500" />
                <span>Tool Used</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                <span>Measurement</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-500" />
                <span>Check-in</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Activity Modal */}
      {selectedDate && (
        <DailyActivityModal
          date={selectedDate}
          isOpen={selectedDate !== null}
          onClose={() => setSelectedDate(null)}
          userId={userId}
        />
      )}
    </>
  );
};
