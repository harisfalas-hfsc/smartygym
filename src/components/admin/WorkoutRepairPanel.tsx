import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Pause, Play, Wrench } from "lucide-react";

type RepairJob = {
  id: string;
  status: string;
  pause_reason: string | null;
  cursor: number;
  total: number;
  auto_fixed: number;
  ai_fixed: number;
  unchanged: number;
  needs_review: number;
  failures: Array<{ id: string; name: string; reason: string }> | null;
  updated_at: string;
};

export default function WorkoutRepairPanel() {
  const [job, setJob] = useState<RepairJob | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("workout_repair_jobs")
      .select("*")
      .in("status", ["running", "paused", "completed"])
      .order("created_at", { ascending: false })
      .limit(1);
    setJob((data?.[0] as RepairJob | undefined) ?? null);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const call = async (action: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("repair-workout-compliance", {
        body: { action },
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error || "Request failed");
      toast.success(
        action === "start"
          ? "Repair job started — it now runs in the background."
          : `Repair job ${action}d.`,
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const running = job?.status === "running";
  const paused = job?.status === "paused";
  const percent = job && job.total ? Math.round((job.cursor / job.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Workout Library Repair
        </CardTitle>
        <CardDescription>
          Repairs every workout the compliance audit flagged. Free fixes first, then a full
          rebuild on the same engine. The original content is backed up before any change, and a
          repaired workout is only saved when it passes the audit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {!running && !paused && (
            <Button onClick={() => call("start")} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Start full repair
            </Button>
          )}
          {running && (
            <Button variant="outline" onClick={() => call("pause")} disabled={busy}>
              <Pause className="mr-2 h-4 w-4" /> Pause
            </Button>
          )}
          {paused && (
            <Button onClick={() => call("resume")} disabled={busy}>
              <Play className="mr-2 h-4 w-4" /> Resume
            </Button>
          )}
          {(running || paused) && (
            <Button variant="ghost" onClick={() => call("cancel")} disabled={busy}>
              Cancel
            </Button>
          )}
          <Button variant="ghost" onClick={load} disabled={busy}>
            Refresh
          </Button>
        </div>

        {job && (
          <>
            <div className="flex items-center gap-3">
              <Badge variant={job.status === "completed" ? "secondary" : paused ? "destructive" : "default"}>
                {job.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {job.cursor} / {job.total} workouts
              </span>
            </div>
            <Progress value={percent} />
            {job.pause_reason && (
              <p className="text-sm text-destructive">{job.pause_reason}</p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Fixed free" value={job.auto_fixed} />
              <Stat label="Rebuilt with AI" value={job.ai_fixed} />
              <Stat label="Already fine" value={job.unchanged} />
              <Stat label="Needs review" value={job.needs_review} />
            </div>
            {!!job.failures?.length && (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
                {job.failures.map((f, i) => (
                  <div key={`${f.id}-${i}`} className="text-sm">
                    <span className="font-medium">{f.name}</span>
                    <span className="block text-xs text-muted-foreground">{f.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3 text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
