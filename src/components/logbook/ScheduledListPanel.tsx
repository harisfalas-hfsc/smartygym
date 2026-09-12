import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, X, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useScheduledWorkouts } from "@/hooks/useScheduledWorkouts";

type Period = "upcoming" | "week" | "month" | "past" | "all";
type Kind = "all" | "workout" | "program";

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const ScheduledListPanel = ({ userId }: { userId: string }) => {
  const { scheduledWorkouts, isLoading, refetch } = useScheduledWorkouts(userId);
  const [period, setPeriod] = useState<Period>("upcoming");
  const [kind, setKind] = useState<Kind>("all");
  const navigate = useNavigate();
  const { toast } = useToast();

  const items = useMemo(() => {
    const today = startOfToday();
    const limit = new Date(today);
    if (period === "week") limit.setDate(limit.getDate() + 7);
    if (period === "month") limit.setDate(limit.getDate() + 30);

    return scheduledWorkouts
      .filter((s) => {
        const date = new Date(`${s.scheduled_date}T00:00:00`);
        if (kind === "workout" && s.content_type === "program") return false;
        if (kind === "program" && s.content_type !== "program") return false;
        if (period === "upcoming") return date >= today;
        if (period === "past") return date < today;
        if (period === "week" || period === "month") return date >= today && date <= limit;
        return true;
      })
      .sort((a, b) =>
        period === "past"
          ? b.scheduled_date.localeCompare(a.scheduled_date)
          : a.scheduled_date.localeCompare(b.scheduled_date)
      );
  }, [scheduledWorkouts, period, kind]);

  const open = (contentType: string, contentId: string) => {
    const route =
      contentType === "custom_workout"
        ? `/my-workouts/${contentId}`
        : contentType === "workout"
          ? `/workout/${contentId}`
          : `/training-programs/${contentId}`;
    navigate(route);
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.from("scheduled_workouts").update({ status: "cancelled" }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Could not remove this scheduled session.", variant: "destructive" });
      return;
    }
    toast({ title: "Schedule removed", description: "The scheduled session was cancelled." });
    refetch();
  };

  const periods: { key: Period; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "week", label: "Next 7 days" },
    { key: "month", label: "Next 30 days" },
    { key: "past", label: "Past" },
    { key: "all", label: "All" },
  ];
  const kinds: { key: Kind; label: string }[] = [
    { key: "all", label: "All" },
    { key: "workout", label: "Workouts" },
    { key: "program", label: "Programs" },
  ];

  return (
    <Card className="mb-4">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-purple-500" />
          <h3 className="text-sm font-semibold">My Scheduled Sessions</h3>
          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {periods.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={period === p.key ? "default" : "outline"}
              className="h-8 shrink-0 rounded-full text-xs"
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {kinds.map((k) => (
            <Button
              key={k.key}
              size="sm"
              variant={kind === k.key ? "secondary" : "ghost"}
              className="h-7 shrink-0 rounded-full text-xs"
              onClick={() => setKind(k.key)}
            >
              {k.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground py-3">Loading your schedule…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">
            Nothing scheduled in this period. Open any workout or program and use “Schedule” to plan it.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((s) => (
              <div key={s.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => open(s.content_type, s.content_id)}
                >
                  <p className="text-sm font-medium line-clamp-2 break-words">{s.content_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(`${s.scheduled_date}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {s.scheduled_time ? ` · ${s.scheduled_time.slice(0, 5)}` : ""}
                    {s.content_type === "program" ? " · Program" : " · Workout"}
                  </p>
                </button>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Remove from schedule"
                  onClick={() => cancel(s.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
